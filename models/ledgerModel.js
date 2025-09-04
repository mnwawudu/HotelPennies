const mongoose = require('mongoose');

const nullToUndef = (v) => (v === null || v === '' ? undefined : v);

/**
 * Ledger rows represent money movements for vendor/user/platform accounts.
 *
 * direction: 'credit' increases balance, 'debit' reduces balance
 * status:
 *   - 'pending'   → earmarked, not yet available
 *   - 'available' → can be paid out (meets releaseOn or was recorded as immediate)
 *
 * Common patterns we use:
 *  - Booking credits:
 *      sourceType: 'booking'
 *      sourceModel: 'HotelBooking' | 'ShortletBooking' | 'RestaurantBooking' | 'EventCenterBooking' | 'TourGuideBooking' | 'Booking'
 *      reason: 'vendor_share' | 'platform_commission' | 'user_cashback' | 'user_referral_commission'
 *  - Payout lock / debit:
 *      sourceType: 'payout',  sourceModel: 'Payout',  reason: 'payout'
 *  - Payout reversal / adjustments:
 *      sourceType: 'payout',  sourceModel: 'Payout',  reason: 'adjustment'
 */

const ledgerSchema = new mongoose.Schema(
  {
    // Who the row belongs to
    accountType: {
      type: String,
      enum: ['vendor', 'user', 'platform'],
      required: true,
    },
    accountModel: {
      type: String,
      // optional; we only ever need 'Vendor' or 'User'. Platform rows should omit.
      enum: ['Vendor', 'User', 'Platform', 'Booking', 'Payout'],
      set: nullToUndef,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'accountModel',
      required: function () {
        // platform rows may not have a specific accountId
        return this.accountType !== 'platform';
      },
      set: (v) => (v ? v : undefined),
    },

    // What generated this row
    sourceType: {
      type: String,
      enum: ['booking', 'payout', 'adjustment'], // keep legacy-friendly
      required: true,
    },
    sourceModel: {
      type: String,
      // now accepts specific booking models for easy filtering
      enum: [
        'Booking',
        'HotelBooking',
        'ShortletBooking',
        'RestaurantBooking',
        'EventCenterBooking',
        'TourGuideBooking',
        'Payout',
      ],
      set: nullToUndef,
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null, set: (v) => (v ? v : undefined) },

    // Convenience link for booking-origin rows
    // (kept as plain ObjectId; populate only if you explicitly know the model)
    bookingId: { type: mongoose.Schema.Types.ObjectId, set: (v) => (v ? v : undefined) },

    // Money
    direction: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },

    // Availability
    status: { type: String, enum: ['pending', 'available'], default: 'pending' },
    releaseOn: { type: Date, default: null },

    // Why this row exists (used heavily in UI)
    reason: {
      type: String,
      enum: [
        'vendor_share',
        'platform_commission',
        'user_cashback',
        'user_referral_commission',
        'payout',
        'adjustment',
      ],
      required: true,
    },

    // Extra info (e.g., bank snapshot, lock ids, etc.)
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

/**
 * Auto-sanitize & fill defaults to prevent enum/null errors:
 * - If accountType === 'platform' → drop accountModel/accountId (platform rows shouldn’t set them)
 * - If sourceModel missing, derive from sourceType (booking→Booking, payout→Payout)
 * - If accountType != 'platform' and accountModel missing, infer from accountType
 */
ledgerSchema.pre('validate', function (next) {
  // platform invariants
  if (this.accountType === 'platform') {
    this.accountModel = undefined;
    this.accountId = undefined;
  } else {
    // infer accountModel when not provided
    if (!this.accountModel) {
      if (this.accountType === 'vendor') this.accountModel = 'Vendor';
      else if (this.accountType === 'user') this.accountModel = 'User';
    }
  }

  // derive sourceModel fallback from sourceType if not provided
  if (!this.sourceModel) {
    if (this.sourceType === 'booking') this.sourceModel = 'Booking';
    else if (this.sourceType === 'payout') this.sourceModel = 'Payout';
  }

  next();
});

// ---------- Helpful indexes (existing) ----------
ledgerSchema.index({ accountType: 1, accountId: 1, status: 1 });
ledgerSchema.index({ sourceType: 1, sourceId: 1 });
ledgerSchema.index({ bookingId: 1 });
ledgerSchema.index({ releaseOn: 1, status: 1 });

// ---------- New compound indexes tailored for admin/audit queries ----------
/**
 * Frequent filters:
 *  - by bookingId (exact), then reason, direction, recency
 */
ledgerSchema.index({ bookingId: 1, reason: 1, direction: 1, createdAt: -1 });

/**
 * Audit by account (user/vendor), narrow by reason & direction, sort by recency
 */
ledgerSchema.index({ accountType: 1, accountId: 1, reason: 1, direction: 1, createdAt: -1 });

/**
 * Broad time-sliced scans by reason/direction (e.g., all referral reversals this week)
 */
ledgerSchema.index({ reason: 1, direction: 1, createdAt: -1 });

/**
 * Optional: query by specific sourceModel fast (e.g. HotelBooking only)
 */
ledgerSchema.index({ sourceType: 1, sourceModel: 1, createdAt: -1 });

module.exports = mongoose.model('Ledger', ledgerSchema);

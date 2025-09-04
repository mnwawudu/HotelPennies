// backend/models/ledgerEntryModel.js
const mongoose = require('mongoose');

/**
 * Ledger stores earnings & adjustments per payee.
 * Amounts are stored as **integer kobo** (NGN minor units). Use only integers.
 *
 * We do NOT store payout holds here. Holds/settlements are derived from Payout docs,
 * so "available" = (credits - debits) - sum(active payout amounts).
 */
const ledgerEntrySchema = new mongoose.Schema(
  {
    // 'vendor' | 'user'
    payeeType: { type: String, enum: ['vendor', 'user'], required: true, index: true },
    payeeId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },

    currency: { type: String, default: 'NGN' },

    /**
     * Positive = credit (earnings or credit adjustment)
     * Negative = debit (adjustment)
     */
    amount: { type: Number, required: true }, // kobo (e.g., ₦1,000 = 100000)

    // For auditing/analytics
    kind: {
      type: String,
      enum: [
        'earning',              // normal earnings from bookings (use business rules upstream)
        'adjustment_credit',    // manual/admin positive adjustment
        'adjustment_debit',     // manual/admin negative adjustment
        'reversal',             // reversal of a previous earning
      ],
      required: true,
    },

    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'HotelBooking', index: true },
    source: { type: String, default: '' }, // e.g. 'hotel', 'shortlet'
    note: { type: String, default: '' },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ payeeType: 1, payeeId: 1, createdAt: -1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);

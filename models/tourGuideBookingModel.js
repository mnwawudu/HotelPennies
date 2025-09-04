// models/tourGuideBookingModel.js
const mongoose = require('mongoose');

function toDateOnlyString(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Anchor date to 12:00:00 UTC on the same calendar day
function normalizeNoonUTC(value) {
  if (!value) return value;
  const d = new Date(value);
  const y = d.getFullYear();        // use local parts to preserve chosen calendar day
  const m = d.getMonth();
  const day = d.getDate();
  return new Date(Date.UTC(y, m, day, 12, 0, 0, 0));
}

const tourGuideBookingSchema = new mongoose.Schema(
  {
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TourGuide',
      required: true,
      index: true,
    },

    // optional so bookings don't fail if guide doc lacks vendorId
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
      required: false,
    },

    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, index: true },

    // Store as Date anchored at noon UTC, plus a YYYY-MM-DD string for UI/emails
    tourDate: { type: Date, required: true, set: normalizeNoonUTC, index: true },
    tourDateLocal: { type: String, default: null }, // 'YYYY-MM-DD' for display/receipts

    numberOfGuests: { type: Number, default: 1 },
    notes: { type: String },

    paymentReference: { type: String, required: true, index: true },
    paymentProvider: { type: String, default: 'paystack' },
    paymentStatus: {
      type: String,
      enum: ['paid', 'unpaid', 'failed'],
      default: 'unpaid',
      index: true,
    },

    totalPrice: { type: Number, required: true },

    // ✅ cancel state
    canceled: { type: Boolean, default: false, index: true },
    cancellationDate: { type: Date, default: null },
  },
  { timestamps: true }
);

tourGuideBookingSchema.index({ guideId: 1, tourDate: -1 });

// Keep tourDateLocal in sync
tourGuideBookingSchema.pre('save', function(next) {
  if (this.isModified('tourDate') && this.tourDate) {
    this.tourDate = normalizeNoonUTC(this.tourDate);
    this.tourDateLocal = toDateOnlyString(this.tourDate);
  }
  next();
});

tourGuideBookingSchema.pre('findOneAndUpdate', function(next) {
  const u = this.getUpdate() || {};
  const s = u.$set || u;

  if (s.tourDate) {
    const nd = normalizeNoonUTC(s.tourDate);
    if (u.$set) {
      u.$set.tourDate = nd;
      u.$set.tourDateLocal = toDateOnlyString(nd);
    } else {
      u.tourDate = nd;
      u.tourDateLocal = toDateOnlyString(nd);
    }
  }
  next();
});

module.exports = mongoose.model('TourGuideBooking', tourGuideBookingSchema);

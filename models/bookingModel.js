// ✅ models/bookingModel.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // Who & what
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', index: true }, // owner of listing
  type: { type: String, index: true }, // hotel, shortlet, restaurant, event, etc.
  propertyId: String,

  // Timeline
  date: { type: Date, default: Date.now },      // created at (legacy)
  checkInDate: { type: Date, index: true },
  checkOutDate: { type: Date, index: true },     // ✅ added; needed for release-after-checkout

  // Money
  baseCost: Number,
  rideRequested: Boolean,
  pickupLocation: String,
  rideCost: Number,
  totalCost: { type: Number, default: 0 },       // gross paid by customer (use this for splits)

  // Split snapshots (optional; ledger is source of truth)
  commission: Number,         // platform’s share snapshot (optional)
  vendorEarnings: Number,     // vendor’s share snapshot (optional)

  // Booking lifecycle (keep your original status; add fine-grained fields)
  status: {
    type: String,
    enum: ['pending', 'completed', 'canceled'],
    default: 'pending',
    index: true,
  },

  // ✅ added: track payment & service phases explicitly
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'failed'],
    default: 'pending',
    index: true,
  },
  serviceStatus: {
    type: String,
    enum: ['booked', 'checked_in', 'checked_out', 'cancelled'],
    default: 'booked',
    index: true,
  },

  // Payout flags (legacy support)
  paidOut: { type: Boolean, default: false },
  payoutDate: Date,

  // ✅ added: cashback / referral context
  cashbackEligible: { type: Boolean, default: false },   // when buyer gets 5%
  referralUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // when referrer gets 5%
  // NOTE: business rule: cashback XOR referral — we’ll enforce in the ledger service

  // Provider trace (optional but useful)
  currency: { type: String, default: 'NGN' },
  paymentRef: String,
  provider: String,  // 'paystack', etc.
}, { timestamps: true });

// Helpful indexes
bookingSchema.index({ vendorId: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);

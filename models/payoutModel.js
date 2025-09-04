// ✅ models/payoutModel.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Payout lifecycle (new canonical):
 *   requested → processing → paid | failed
 *
 * Legacy statuses kept for backward compatibility in filters:
 *   approved (≈ processing), rejected (≈ failed), cancelled, pending
 * Use ACTIVE_PAYOUT_STATUSES when checking for "one active request".
 */
const ACTIVE_PAYOUT_STATUSES = ['requested', 'processing'];

const bankSnapshotSchema = new Schema(
  {
    bankName: String,
    bankCode: String,
    accountNumber: String,
    accountName: String,
  },
  { _id: false }
);

const payoutSchema = new Schema(
  {
    // who gets paid
    payeeType: { type: String, enum: ['vendor', 'user'], required: true, index: true },
    vendorId:  { type: Schema.Types.ObjectId, ref: 'Vendor' },
    userId:    { type: Schema.Types.ObjectId, ref: 'User' },

    // money (NGN major units)
    amount:   { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'NGN' },

    // lifecycle
    status: {
      type: String,
      enum: ['requested', 'processing', 'paid', 'failed', 'approved', 'rejected', 'cancelled', 'pending'],
      default: 'requested',
      index: true,
    },
    method: { type: String, enum: ['manual', 'auto', 'paystack', 'flutterwave'], default: 'manual' },

    // traceability
    provider:    { type: String },     // e.g., 'paystack'
    transferRef: { type: String },     // provider reference / RRN
    bookingIds:  [{ type: Schema.Types.ObjectId, ref: 'Booking' }],

    // request context
    requestedAt: { type: Date, default: Date.now },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    balanceAtRequest: { type: Number },

    // bank snapshot at the moment of request
    bank: bankSnapshotSchema,

    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Validation: correct id field present
payoutSchema.pre('validate', function (next) {
  if (this.payeeType === 'vendor' && !this.vendorId) {
    return next(new Error('vendorId is required when payeeType is "vendor"'));
  }
  if (this.payeeType === 'user' && !this.userId) {
    return next(new Error('userId is required when payeeType is "user"'));
  }
  next();
});

// Virtual for legacy UI filters
payoutSchema.virtual('uiStatus').get(function () {
  const s = this.status;
  if (s === 'requested' || s === 'approved' || s === 'processing' || s === 'pending') return 'pending';
  if (s === 'paid') return 'paid';
  if (s === 'failed' || s === 'rejected' || s === 'cancelled') return 'failed';
  return s;
});

// Indexes
payoutSchema.index({ payeeType: 1, vendorId: 1, userId: 1, status: 1, createdAt: -1 });
payoutSchema.index({ transferRef: 1 }, { unique: false, sparse: true });

// Enforce one *active* request (requested OR processing) per vendor
payoutSchema.index(
  { payeeType: 1, vendorId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      payeeType: 'vendor',
      vendorId: { $type: 'objectId' },
      status: { $in: ACTIVE_PAYOUT_STATUSES }, // ['requested','processing']
    },
  }
);

// Enforce one *active* request (requested OR processing) per user
payoutSchema.index(
  { payeeType: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      payeeType: 'user',
      userId: { $type: 'objectId' },
      status: { $in: ACTIVE_PAYOUT_STATUSES },
    },
  }
);


module.exports = mongoose.model('Payout', payoutSchema);

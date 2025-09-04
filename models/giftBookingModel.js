// ✅ models/giftBookingModel.js
const mongoose = require('mongoose');

const giftBookingSchema = new mongoose.Schema(
  {
    gift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gift',
      required: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      default: 'N/A',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },
    paymentRef: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GiftBooking', giftBookingSchema);

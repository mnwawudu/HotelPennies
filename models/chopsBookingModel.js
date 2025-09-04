const mongoose = require('mongoose');

const chopsBookingSchema = new mongoose.Schema(
  {
    chop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chop',
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

module.exports = mongoose.model('ChopsBooking', chopsBookingSchema);

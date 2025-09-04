const mongoose = require('mongoose');

const shortletBookingSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },       // User email for identification
  phone: { type: String, required: true },
  checkIn: { type: Date, required: true },
  checkOut: { type: Date, required: true },
  guests: { type: Number, required: true },
  shortlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Shortlet', required: true },
  price: { type: Number, required: true },
  paymentReference: { type: String },
  paymentProvider: { type: String },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  },
  canceled: {
    type: Boolean,
    default: false
  },
  cancellationDate: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Prevent OverwriteModelError by checking if model already exists
module.exports = mongoose.models.ShortletBooking || mongoose.model('ShortletBooking', shortletBookingSchema);

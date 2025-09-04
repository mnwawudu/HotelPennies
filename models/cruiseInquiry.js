// ✅ models/CruiseInquiry.js
const mongoose = require('mongoose');

const cruiseInquirySchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    pickupLocation: { type: String, required: true },
    destinations: { type: String, required: true }, // Let user freely type or list areas
    numberOfGuests: { type: Number, required: true },
    durationHours: { type: Number, required: true },
    preferredDate: { type: Date, required: true },

    expectations: { type: String },
    preferredContact: { type: String, enum: ['email', 'whatsapp', 'phone'], default: 'whatsapp' },

    responded: { type: Boolean, default: false },
    adminNote: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CruiseInquiry', cruiseInquirySchema);

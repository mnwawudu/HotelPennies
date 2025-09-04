// models/hiddenOrderModel.js
const mongoose = require('mongoose');

const hiddenOrderSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bookingId:       { type: mongoose.Schema.Types.ObjectId, required: true },
  bookingCategory: { type: String, enum: ['hotel','shortlet','event','restaurant','tour','chops','gifts'], required: true },
  createdAt:       { type: Date, default: Date.now },
}, { timestamps: true });

// avoid dupes per user+booking
hiddenOrderSchema.index({ userId: 1, bookingCategory: 1, bookingId: 1 }, { unique: true });

module.exports = mongoose.model('HiddenOrder', hiddenOrderSchema);

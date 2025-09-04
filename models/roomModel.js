const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  guestCapacity: { type: Number, required: true },
  bedType: { type: String, required: true },
  promoPrice: { type: Number },
  complimentary: { type: String },
  description: { type: String },
  images: [String],
  mainImage: { type: String }, // ✅ Add this line
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  unavailableDates: [Date],
  isFeatured: { type: Boolean, default: false }
}, {
  timestamps: true
});

module.exports = mongoose.model('Room', roomSchema);

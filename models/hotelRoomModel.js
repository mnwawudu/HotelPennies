// ✅ models/hotelRoomModel.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const hotelRoomSchema = new mongoose.Schema({
  hotelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  promoPrice: { type: Number },
  description: { type: String },
  features: [String],
  bed: { type: String },
  guests: { type: Number },
  complimentary: { type: String },
  images: [String],
  mainImage: { type: String },
  available: { type: Boolean, default: true },

unavailableDates: {
  type: [Date],
  default: []
},

  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureStartDate: { type: Date },
  featureDuration: { type: String, enum: ['7days', '1month', '6months', '1year'], default: '7days' },
  featureEndDate: { type: Date },

  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.HotelRoom || mongoose.model('HotelRoom', hotelRoomSchema);


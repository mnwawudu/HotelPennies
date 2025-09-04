// 📁 models/restaurantMenuModel.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const menuItemSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  promoPrice: Number,
  complimentary: String,
  available: { type: Boolean, default: true },

unavailableDates: {
  type: [Date],
  default: []
},

  images: [String], // ✅ multiple images
  mainImage: String, // ✅ align with UploadImageModal logic
  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date },
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RestaurantMenu', menuItemSchema);

const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, required: true },
  comment: String,
  createdAt: { type: Date, default: Date.now }
});

const giftSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  promo: { type: Boolean, default: false },
  promoPrice: Number,
  complimentary: String,
  description: String,
  hasDelivery: { type: Boolean, default: false },
  deliveryFee: Number,

  images: [String],
  mainImage: String,

  city: { type: String }, // ✅ Added city here

  available: { type: Boolean, default: true },
  unavailableDates: [Date],

  featured: { type: Boolean, default: false },
  featureType: String,
  featureExpiresAt: Date,

  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gift', giftSchema);

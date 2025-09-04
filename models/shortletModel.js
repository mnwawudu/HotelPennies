const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: String,
  rating: Number,
  comment: String,
}, { timestamps: true });

const shortletSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: String,
  location: String,
  price: Number,
  promoPrice: Number,
  complimentary: String,
  description: String,
  city: String,
  state: String,
  images: [String],
  mainImage: String,
  available: { type: Boolean, default: true },
  unavailableDates: {
    type: [Date],
    default: []
  },
   termsAndConditions: {
    type: String,
    default: ''
  },
  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date, default: null },
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Shortlet', shortletSchema);

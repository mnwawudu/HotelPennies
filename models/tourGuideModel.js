// 📁 models/tourGuideModel.js
const mongoose = require('mongoose');

// ✅ Review Schema
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Tour Guide Schema
const tourGuideSchema = new mongoose.Schema({
  name: { type: String, required: true },
  bio: { type: String },                    // ✅ Bio for the guide
  language: { type: String },
  experience: { type: Number },
  location: { type: String },
  state: { type: String },
  city: { type: String },

  price: { type: Number, required: true },
  description: { type: String },
  available: { type: Boolean, default: true },
  unavailableDates: {
    type: [Date],
    default: []
  },
   termsAndConditions: {
    type: String,
    default: ''
  },

  hostImage: { type: String },             // ✅ Host/portrait image
  images: [String],                        // ✅ For UploadImageModal
  mainImage: { type: String },             // ✅ Main image URL
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },

  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },

  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date },

  promoPrice: { type: Number },
  usePromo: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TourGuide', tourGuideSchema);

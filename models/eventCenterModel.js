const mongoose = require('mongoose');

// ✅ Review schema (same as universal)
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ✅ Main Event Center Schema
const eventCenterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  capacity: { type: Number, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  images: [String],

  // ✅ Main Image (for frontend display)
  mainImage: { type: String },

  // ✅ Persisting Calendar Dates
  available: { type: Boolean, default: true },
  unavailableDates: {
    type: [Date],
    default: []
  },

  // ✅ Terms
  termsAndConditions: {
    type: String,
    default: ''
  },

  // ✅ Opening & Closing Hours
  openingHours: {
    open: { type: String },   // e.g., "08:00 AM"
    close: { type: String }   // e.g., "10:00 PM"
  },

  // ✅ Feature controls
  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date },

  // ✅ Monetization classification
  listingType: {
    type: String,
    enum: ['eventcenter'],
    default: 'eventcenter',
    required: true,
  },

  // ✅ Promotions
  promoPrice: { type: Number, default: null },
  usePromo: { type: Boolean, default: false },

  // ✅ Reviews
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },

  // ✅ Created timestamp
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventCenter', eventCenterSchema);

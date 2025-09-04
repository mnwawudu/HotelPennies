const mongoose = require('mongoose');

// Review schema
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Menu item schema
const menuItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  price: { type: Number, required: true }
});

// ✅ Restaurant schema
const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisineType: { type: String },
  location: { type: String, required: true },
  priceRange: { type: String },
  description: String,
  state: { type: String, required: true },
  city: { type: String, required: true },
    openingHours: {
    open: { type: String },   // e.g., "08:00 AM"
    close: { type: String }   // e.g., "10:00 PM"
  },

  termsAndConditions: {
    type: String,
    default: ''
  },

   available: { type: Boolean, default: true },

unavailableDates: {
  type: [Date],
  default: []
},
  images: [String],


  // ✅ Add this line to support main image
  mainImage: { type: String },

  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  menus: [menuItemSchema],

  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },

  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Restaurant', restaurantSchema);

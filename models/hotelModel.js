// ✅ models/hotelModel.js
const mongoose = require('mongoose');

// ✅ Review schema (universal)
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Normalizer used by schema + hooks
function normalizeAmenities(v) {
  const arr = Array.from(
    new Set(
      []
        .concat(v || [])
        .map(x => String(x).toLowerCase().trim())
        .filter(Boolean)
    )
  );

  // 🇳🇬 Nigeria setting: breakfast implies restaurant availability
  if (arr.includes('breakfast') && !arr.includes('restaurant')) {
    arr.push('restaurant');
  }
  return arr;
}

const hotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  location: String,
  state: String,
  city: String,
  description: String,
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
  minPrice: { type: Number, required: true },
  maxPrice: { type: Number, required: true },

  images: { type: [String], default: [] },   // ✅ add a safe default
  mainImage: { type: String, default: '' },  // ✅ safe default

  termsAndConditions: { type: String, default: '' },

  // ✅ Amenities (pool, gym, restaurant, parking, breakfast, casino, etc.)
  amenities: {
    type: [String],
    default: [],
    set: normalizeAmenities
  },

  bookingsCount: { type: Number, default: 0 },

  // ✅ NEW: tracked count of attached rooms (used to hide hotels with 0 rooms)
  roomsCount: { type: Number, default: 0, index: true }, // 👈 **new**

  // ✅ Availability for calendar
  available: { type: Boolean, default: true },
  unavailableDates: { type: [Date], default: [] },

  // ✅ Feature system
  isFeatured: { type: Boolean, default: false },
  featureType: { type: String, enum: ['local', 'global'], default: 'local' },
  featureExpiresAt: { type: Date },

  // ✅ Reviews
  reviews: [reviewSchema],
  averageRating: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now }
});

// As a belt-and-braces, also enforce on save (covers updates that bypass setter)
hotelSchema.pre('save', function(next) {
  this.amenities = normalizeAmenities(this.amenities);
  // If description mentions breakfast/complimentary breakfast, mark restaurant
  const desc = String(this.description || '').toLowerCase();
  if ((/breakfast/.test(desc) || /complimentary\s+breakfast/.test(desc)) &&
      !this.amenities.includes('restaurant')) {
    this.amenities.push('restaurant');
  }
  // Dedupe again
  this.amenities = Array.from(new Set(this.amenities));
  next();
});

// ✅ Speed index for list pages that hide hotels without rooms
// (query: { roomsCount: { $gt: 0 } } sort: { createdAt: -1 })
hotelSchema.index({ roomsCount: 1, createdAt: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);

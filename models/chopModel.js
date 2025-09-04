const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, default: 'Anonymous' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const chopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  images: [{ type: String }],
  mainImage: { type: String },

  price: { type: Number, required: true },
  promoPrice: { type: Number },
  promo: { type: Boolean, default: false },

  hasDelivery: { type: Boolean, default: false },
  deliveryFee: { type: Number, default: 0 },
  complimentary: { type: String, default: '' },

  description: { type: String },
  available: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },

  city: { type: String, required: true },

  // ✅ Reviews + rating
  reviews: { type: [reviewSchema], default: [] },
  averageRating: { type: Number, default: 0 },

  // ✅ For ranking like other categories
  bookingsCount: { type: Number, default: 0 },
  ctr: { type: Number, default: 0 },

  unavailableDates: { type: [Date], default: [] },

  createdAt: { type: Date, default: Date.now },
});

// (Optional safety) clamp averageRating into [0,5] if set directly
chopSchema.pre('save', function (next) {
  if (typeof this.averageRating === 'number') {
    this.averageRating = Math.max(0, Math.min(5, this.averageRating));
  }
  next();
});

module.exports = mongoose.model('Chop', chopSchema);

// ✅ models/cruiseModel.js
const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  userName: String,
  rating: {
    type: Number,
    required: true,
  },
  comment: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const cruiseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      default: 'city cruise', // Future: yacht, boat cruise etc.
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    duration: String,        // e.g. '1hr', '3hrs'
    price: Number,           // e.g. ₦30000
    pricePerHour: Number,    // Optional alternative

    city: String,
    state: String,
	 unavailableDates: {
    type: [Date],
    default: []

},


    images: [String],         // ✅ NEW: Array of image URLs from Cloudinary
	mainImage: String, 
	complimentary: {
  type: String,
  default: '',
},


    isPublished: {
      type: Boolean,
      default: true,
    },

    reviews: [reviewSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cruise', cruiseSchema);

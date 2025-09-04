const mongoose = require('mongoose');

const ALLOWED_TYPES = ['local', 'global'];            // scope
const ALLOWED_DURATIONS = ['7d', '1m', '6m', '1y'];   // plans

const featurePricingSchema = new mongoose.Schema(
  {
    // scope: local vs global
    type: {
      type: String,
      enum: ALLOWED_TYPES,
      required: true,
      trim: true,
      lowercase: true,
    },

    // plan length
    duration: {
      type: String,
      enum: ALLOWED_DURATIONS,
      required: true,
      trim: true,
      lowercase: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

// One price per (type, duration)
featurePricingSchema.index({ type: 1, duration: 1 }, { unique: true });

module.exports = mongoose.model('FeaturePricing', featurePricingSchema);

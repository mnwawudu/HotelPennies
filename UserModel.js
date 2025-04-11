const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    affiliateCode: {
      type: String,
      unique: true
    },
    referredBy: {
      type: String, // Can later be changed to ObjectId if referencing another user
      default: null
    },
    commissions: {
      type: Number,
      default: 0
    },
    payouts: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

module.exports = mongoose.model('User', userSchema);

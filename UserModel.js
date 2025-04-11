const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    affiliateCode: {
      type: String,
      unique: true,
    },
    referredBy: {
      type: String, // Can be changed to ObjectId if linking to another user
      default: null,
    },
    commissions: {
      type: Number,
      default: 0,
    },
    payouts: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

module.exports = mongoose.model('User', userSchema);

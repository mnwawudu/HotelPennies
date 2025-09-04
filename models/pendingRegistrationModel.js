// ✅ models/pendingRegistrationModel.js
const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    // Who is registering
    name: { type: String, default: '' },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },

    state: { type: String, default: '' },
    city:  { type: String, default: '' },
 
    // 'user' | 'vendor'
    userType: { type: String, required: true, enum: ['user', 'vendor'] },

    // For vendors (optional)
    businessTypes: { type: [String], default: [] },

    // Store ONE of the following:
    // Prefer passwordHash (already hashed in /register)
    passwordHash: { type: String, default: null },
    // Fallback (legacy) if you temporarily stored plaintext; verify & hash on verify step
    password: { type: String, default: null },

    // housekeeping
    createdAt: { type: Date, default: Date.now },
    // TTL anchor — document auto-deletes when this passes
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      required: true,
    },
  },
  { collection: 'pending_registrations' }
);

// TTL index — expires exactly at `expiresAt`
pendingRegistrationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Helpful lookup
pendingRegistrationSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);

// ✅ models/adminModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const adminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },

  role:     { type: String, enum: ['superadmin', 'manager', 'staff'], default: 'admin' },

  // 🔐 added for password lifecycle / sessions
  passwordUpdatedAt: { type: Date, default: Date.now },
  tokenVersion: { type: Number, default: 0 },

  // 🔁 password reset (token is stored as a hash)
  resetTokenHash:   { type: String, select: false },
  resetTokenExpires:{ type: Date },
}, { timestamps: true });

// 🔒 hash password when modified
adminSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordUpdatedAt = new Date();
    this.tokenVersion = (this.tokenVersion || 0) + 1;
  }
  next();
});

// 🔧 helpers
adminSchema.methods.setPassword = async function (plain) {
  this.password = plain; // pre('save') will hash
  this.passwordUpdatedAt = new Date();
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

adminSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password || '');
};

adminSchema.methods.issuePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 60 mins
  return token; // return raw token for email
};

module.exports = mongoose.model('Admin', adminSchema);

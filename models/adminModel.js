// models/adminModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const ROLES = ['superadmin', 'admin', 'manager', 'staff'];

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },

    // keep password non-select by default (safer)
    password: { type: String, required: true, select: false },

    // principle of least privilege: default 'staff'
    role: { type: String, enum: ROLES, default: 'staff', index: true },

    // token invalidation + lifecycle
    passwordUpdatedAt: { type: Date, default: Date.now },
    tokenVersion: { type: Number, default: 0 },

    // password reset (stored as HASH, not raw)
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordUpdatedAt = new Date();
  this.tokenVersion = (this.tokenVersion || 0) + 1;
  next();
});

adminSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

adminSchema.methods.setPassword = async function (plain) {
  this.password = plain; // will be hashed by pre('save')
};

adminSchema.methods.issuePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 60 mins
  return token; // raw token (email this)
};

module.exports = mongoose.model('Admin', adminSchema);
module.exports.ROLES = ROLES;

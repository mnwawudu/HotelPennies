const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },

  // NEW (optional, for origins/filters)
  state: { type: String, default: '' },
  city:  { type: String, default: '' },

  password: { type: String, required: true },

  // 🔐 added for password lifecycle / sessions
  passwordUpdatedAt: { type: Date, default: Date.now },
  tokenVersion: { type: Number, default: 0 },

  // 🔁 password reset (token is stored as a hash)
  resetTokenHash:   { type: String, select: false },
  resetTokenExpires:{ type: Date },

  userCode: { type: String, required: true, unique: true },
  affiliateLink: { type: String, required: true },

  // 🆕 Who referred this user (if they signed up via a link/code)
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // List of users this user referred (User IDs)
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // 🆕 Guard list to prevent double-paying commission for the same buyer email
  referredEmails: { type: [String], default: [] },

  // When referrals convert
  referralConversions: [{
    referralId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    amountEarned: Number,
    date: { type: Date, default: Date.now }
  }],

  // All earnings (both commission and cashback)
  // booking = commission, transaction = cashback
  // *_reversal rows are compensating negatives we post on cancellations
  earnings: [{
    amount: Number,
    source: { type: String, enum: ['booking', 'transaction', 'transaction_reversal', 'referral_reversal'] },
    sourceId: mongoose.Schema.Types.ObjectId,
    status: { type: String, default: 'pending' }, // e.g., pending | available | reversed | posted
    createdAt: { type: Date, default: Date.now }
  }],

  payoutStatus: {
    totalEarned: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    monthlyEarned: { type: Number, default: 0 },
    isFirstPayoutHandled: { type: Boolean, default: false },
    lastPayoutDate: { type: Date },
    linkedAccountId: { type: String }
  },

  payoutHistory: [{
    amount: Number,
    date: { type: Date, default: Date.now },
    method: String,
    status: { type: String, enum: ['pending', 'paid'], default: 'pending' }
  }],

  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailTokenExpires: { type: Date }
}, { timestamps: true });

// ✅ Normalize email on save (lowercase/trim)
userSchema.pre('save', function (next) {
  if (this.isModified('email') && this.email) {
    this.email = String(this.email).trim().toLowerCase();
  }
  next();
});

// ✅ Trim state/city (harmless normalizer)
userSchema.pre('save', function (next) {
  ['state', 'city'].forEach((k) => {
    if (this.isModified(k) && this[k]) this[k] = String(this[k]).trim();
  });
  next();
});

// ✅ Password hashing middleware
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordUpdatedAt = new Date();
    this.tokenVersion = (this.tokenVersion || 0) + 1;
  }
  next();
});

// ✅ Static method to find user by email
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// 🔧 helpers
userSchema.methods.setPassword = async function (plain) {
  this.password = plain; // pre('save') will hash
  this.passwordUpdatedAt = new Date();
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

userSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password || '');
};

userSchema.methods.issuePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 60 mins
  return token; // return raw token for email
};

// ✅ Ensure affiliateLink is unique
userSchema.index({ affiliateLink: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);

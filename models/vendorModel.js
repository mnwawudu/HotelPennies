const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const payoutAccountSchema = new mongoose.Schema(
  {
    bankName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    accountName: { type: String, default: '' },

    // For Paystack transfers
    bankCode: { type: String, default: null },       // e.g. "058" for GTBank
    recipientCode: { type: String, default: null },  // Paystack transferrecipient code

    // UI/logic helpers
    isLocked: { type: Boolean, default: false },     // one of the accounts can be "locked" as the active withdrawal target
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const payoutHistorySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },

    account: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      accountName: { type: String, default: '' },
    },

    // Provider/processor metadata (used for webhooks & audits)
    provider: { type: String, "enum": ['paystack', 'manual', ''], default: '' },
    providerRef: { type: String, default: null }, // e.g., Paystack transfer reference/transfer_code

    date: { type: Date, default: Date.now },

    // Expanded lifecycle to support automatic withdrawals
    status: {
      type: String,
      "enum": ['pending', 'processing', 'paid', 'failed'],
      default: 'pending',
    },

    // Optional link back to a booking for reconciliation/backfill
    bookingId: { type: mongoose.Schema.Types.ObjectId, default: null },
    category: { type: String, default: null }, // 'hotel' | 'shortlet' | 'eventcenter' | 'restaurant' | 'tourguide'
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    message: String,
    read: { type: Boolean, default: false },
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const businessTypeSchema = new mongoose.Schema(
  {
    serviceType: { type: String }, // e.g. 'hotel', 'eventcenter'
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    phone: { type: String, required: true, unique: true, index: true },
    address: { type: String, required: true },

    // NEW (optional, for origins/filters)
    state: { type: String, default: '' },
    city:  { type: String, default: '' },

    // 🔐 password lifecycle / sessions
    passwordUpdatedAt: { type: Date, default: Date.now },
    tokenVersion: { type: Number, default: 0 },

    // 🔁 password reset (token is stored as a hash)
    resetTokenHash:   { type: String, select: false },
    resetTokenExpires:{ type: Date },

    vendorCode: { type: String, unique: true, sparse: true },

    userType: { type: String, "enum": ['vendor'], required: true },

    businessTypes: [businessTypeSchema],

    // Legacy single field kept (some UIs might still read it)
    idType: { type: String },

    documents: {
      meansOfId: { type: String },
      meansOfIdHash: { type: String },
      cacCertificate: { type: String },
      proofOfAddress: { type: String },
    },

    // ✅ KYC state used by the UI
    kycStatus: {
      type: String,
      "enum": ['PENDING','PROCESSING','REJECTED','APPROVED'],
      default: 'PENDING'
    },

    // Structured KYC object: inputs + per-check status
    kyc: {
      provider: { type: String, default: '' },       // e.g. 'kycguard', 'dojah'
      lastUpdatedAt: { type: Date, default: null },

      // what the vendor submitted
      vendorInput: {
        idType: { type: String, "enum": ['nin','passport','license','none'], default: 'none' },
        idNumber: { type: String, default: '' },     // consider encrypting at rest
        cacNumber: { type: String, default: '' },    // RC/BN
      },

      // per-check states (what your sidebar reads: kyc.checks.identity.status / company.status)
      checks: {
        identity: {
          status: { type: String, "enum": ['idle','processing','approved','rejected'], default: 'idle' },
          provider: { type: String, default: '' },
          providerRef: { type: String, default: '' },
          note: { type: String, default: '' },
          updatedAt: { type: Date },
          result: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        company: {
          status: { type: String, "enum": ['idle','processing','approved','rejected'], default: 'idle' },
          provider: { type: String, default: '' },
          providerRef: { type: String, default: '' },
          note: { type: String, default: '' },
          updatedAt: { type: Date },
          result: { type: mongoose.Schema.Types.Mixed, default: {} },
        }
      }
    },

    isVerifiedTypes: { type: [String], default: [] },
    isFullyVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: true },

    // ⬇️⬇️ ADDED: persist email verification token/expiry (surgical)
    emailVerificationToken: { type: String },
    emailTokenExpires: { type: Date },

    // 🔒 Lockable payout accounts used by automatic withdrawals
    payoutAccounts: { type: [payoutAccountSchema], default: [] },
    lockedPayoutAccountIndex: { type: Number, default: null }, // which payoutAccounts[index] is the active one

    // 💸 Payout ledger with richer status & provider metadata
    payoutHistory: { type: [payoutHistorySchema], default: [] },

    notifications: { type: [notificationSchema], default: [] },

    // 🧹 Soft-delete / closure flags for safe account deletion
    status: { type: String, "enum": ['active', 'closed'], default: 'active' },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ✅ Normalize email on save (lowercase/trim)
vendorSchema.pre('save', function (next) {
  if (this.isModified('email') && this.email) {
    this.email = String(this.email).trim().toLowerCase();
  }
  next();
});

// ✅ Trim state/city (harmless normalizer)
vendorSchema.pre('save', function (next) {
  ['state', 'city'].forEach((k) => {
    if (this.isModified(k) && this[k]) this[k] = String(this[k]).trim();
  });
  next();
});

// ✅ Password hashing middleware
vendorSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordUpdatedAt = new Date();
    this.tokenVersion = (this.tokenVersion || 0) + 1;
  }
  next();
});

// ✅ Static method to find vendor by email
vendorSchema.statics.findByEmail = function (email) {
  return this.findOne({ email });
};

// 🔧 helpers
vendorSchema.methods.setPassword = async function (plain) {
  this.password = plain; // pre('save') will hash
  this.passwordUpdatedAt = new Date();
  this.tokenVersion = (this.tokenVersion || 0) + 1;
};

vendorSchema.methods.verifyPassword = async function (plain) {
  return bcrypt.compare(plain, this.password || '');
};

vendorSchema.methods.issuePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
  this.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 60 mins
  return token; // return raw token for email
};

module.exports = mongoose.model('Vendor', vendorSchema);

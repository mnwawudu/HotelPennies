// routes/register.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const PendingRegistration = require('../models/pendingRegistrationModel');
const { generateCode } = require('../utils/codeGenerator');
const sendVerificationEmail = require('../utils/sendVerificationEmail');

console.log('🔧 [register] route file loaded'); // fires on require()

router.post('/register', async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    address,
    state = '',
    city = '',
    userType,            // 'user' | 'vendor'  (MUST be provided)
    businessTypes = [],  // array for vendors
  } = req.body;

  try {
    // 1) Validate required fields
    if (!userType || !['user', 'vendor'].includes(String(userType).toLowerCase())) {
      return res.status(400).json({ message: 'Invalid user type' });
    }
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Normalize
    const normEmail = String(email).trim().toLowerCase();
    const normPhone = String(phone).trim();

    // 2) Global uniqueness checks
    const [emailUser, emailVendor] = await Promise.all([
      User.findOne({ email: normEmail }).select('_id'),
      Vendor.findOne({ email: normEmail }).select('_id'),
    ]);
    if (emailUser || emailVendor) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    if (normPhone) {
      const [phoneUser, phoneVendor] = await Promise.all([
        User.findOne({ phone: normPhone }).select('_id'),
        Vendor.findOne({ phone: normPhone }).select('_id'),
      ]);
      if (phoneUser || phoneVendor) {
        return res.status(400).json({ message: 'Phone number is already in use' });
      }
    }

    // 3) Hash password now (never send plaintext)
    const passwordHash = await bcrypt.hash(String(password), 12);

    // 4) Create pending registration (includes state/city)
    const pending = await PendingRegistration.create({
      name: String(name || '').trim(),
      email: normEmail,
      phone: normPhone,
      address: String(address || '').trim(),
      state: String(state || '').trim(),
      city:  String(city  || '').trim(),
      userType: String(userType).toLowerCase(),
      businessTypes: Array.isArray(businessTypes) ? businessTypes : [],
      passwordHash,
      // expiresAt handled by model default (24h TTL)
    });

    console.log('🟢 [register] PendingRegistration created:', pending._id.toString(), normEmail, String(userType).toLowerCase());

    // 5) Build verification token with ONLY the JTI (pending _id)
    const verificationToken = jwt.sign(
      { jti: String(pending._id) },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const base = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || '';
    const activationLink = `${base}/verify-email/${verificationToken}`;

    console.log('🔗 [register] activationLink:', activationLink);

    // 6) Send email
    await sendVerificationEmail(normEmail, name, activationLink);

    // 7) Respond
    return res.status(200).json({
      message: 'Registration email sent. Please verify your email to activate your account.',
      token: verificationToken, // your UI doesn’t use this, but we keep parity
    });
  } catch (err) {
    console.error('❌ [register] error:', err?.stack || err);
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

module.exports = router; 
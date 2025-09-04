// routes/registerRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel'); // for global phone uniqueness
const { generateCode } = require('../utils/codeGenerator');
const sendVerificationEmail = require('../utils/sendVerificationEmail');

/* ───────────────────────── Register (User) ───────────────────────── */
router.post('/register', async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    address,
    state = '',
    city = '',
  } = req.body;

  try {
    // Validate required fields (state/city optional)
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    const normEmail = String(email).trim().toLowerCase();
    const normPhone = String(phone).trim();

    // Email uniqueness (user collection)
    const existingUser = await User.findOne({ email: normEmail }).lean();
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    // Global phone uniqueness (users + vendors)
    const [uPhone, vPhone] = await Promise.all([
      User.findOne({ phone: normPhone }).select('_id'),
      Vendor.findOne({ phone: normPhone }).select('_id'),
    ]);
    if (uPhone || vPhone) {
      return res.status(400).json({ message: 'Phone number is already in use.' });
    }

    // Hash password and generate values
    const hashedPassword = await bcrypt.hash(password, 10);
    const userCode = generateCode();
    const affiliateLink = `${process.env.FRONTEND_BASE_URL}/ref/${userCode}`;

    // Create user as UNVERIFIED (do NOT persist any emailVerificationToken fields)
    const newUser = new User({
      name,
      email: normEmail,
      password: hashedPassword,
      phone: normPhone,
      address: String(address || '').trim(),
      state: String(state || '').trim(),
      city: String(city || '').trim(),
      userCode,
      affiliateLink,
      isEmailVerified: false,
      // intentionally NOT setting: emailVerificationToken, emailTokenExpires
    });

    await newUser.save();

    // Build short-lived email verification token that carries ONLY the user id
    const emailVerificationToken = jwt.sign(
      { sub: String(newUser._id), role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    const activationLink = `${process.env.FRONTEND_BASE_URL}/verify-email/${emailVerificationToken}`;

    // Send verification email
    await sendVerificationEmail(normEmail, name, activationLink);

    return res.status(201).json({
      message: 'Registration successful! Please check your email to verify your account.',
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

/* ─────────────── Verify Email (hit by /verify-email/:token page) ─────────────── */
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Verify token (1 day TTL)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded?.sub || decoded?.id || decoded?._id;
    if (!userId) {
      return res.status(400).json({ message: 'Invalid verification token.' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    // Mark verified (idempotent) and clear any legacy fields if present
    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
    }
    user.emailVerificationToken = undefined;
    user.emailTokenExpires = undefined;
    await user.save();

    // Issue an app auth token so the frontend can auto-sign in & redirect
    const appToken = jwt.sign(
      { id: user._id, email: user.email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token: appToken });
  } catch (err) {
    console.error('❌ Email verification error:', err);
    return res.status(400).json({ message: 'Invalid or expired token' });
  }
});

module.exports = router;

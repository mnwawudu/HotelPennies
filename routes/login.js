const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('📥 Login attempt:', email);

  try {
    let account = await User.findOne({ email });
    let role = 'user';

    if (!account) {
      account = await Vendor.findOne({ email });
      role = 'vendor';
    }

    if (!account) {
      console.log('❌ Account not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, account.password);
    if (!isMatch) {
      console.log('❌ Invalid password');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Email verification check (only for users)
    if (role === 'user' && !account.isEmailVerified) {
      console.log('❌ User email not verified');
      return res.status(400).json({ message: 'Please verify your email before logging in.' });
    }

    const token = jwt.sign(
      {
        id: account._id,
        email: account.email,
        role,
        userType: role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful for:', role, '=> ID:', account._id.toString());

    return res.status(200).json({
      message: 'Login successful',
      token,
      role,
      user: {
        id: account._id,
        email: account.email,
        name: account.name || '',
      }
    });

  } catch (err) {
    console.error('❌ Login error:', err);
    return res.status(500).json({ message: 'Login failed', error: err.message });
  }
});

module.exports = router;

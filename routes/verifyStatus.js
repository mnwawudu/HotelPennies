// ✅ routes/verifyStatus.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');

router.get('/verify-status', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const vendor = await Vendor.findOne({ email, isEmailVerified: true });
    const user = await User.findOne({ email, isEmailVerified: true });

    const account = vendor || user;
    if (!account) return res.json({ verified: false });

    const token = jwt.sign(
      { id: account._id, role: vendor ? 'vendor' : 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      verified: true,
      token,
      role: vendor ? 'vendor' : 'user'
    });
  } catch (err) {
    console.error('Error checking verification status:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

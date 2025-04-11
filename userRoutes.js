const express = require('express');
const router = express.Router();
const User = require('./UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

router.post('/register', async (req, res) => {
  console.log('✅ Received body:', req.body);

  const { name, email, password, referredBy = null } = req.body;

  // Trim to avoid whitespace errors
  if (!name?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const affiliateCode = generateCode();

    const user = new User({
      name,
      email,
      password: hashedPassword,
      referredBy,
      affiliateCode
    });

    await user.save();

    // Handle referral logic
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.commissions += 10;
        await referrer.save();
      }
    }

    res.status(201).json({ message: 'User registered', affiliateCode });
  } catch (err) {
    console.error('❌ Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

module.exports = router;

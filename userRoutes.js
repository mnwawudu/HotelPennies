const express = require('express');
const router = express.Router();
const User = require('./UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ✅ REGISTER
router.post('/register', async (req, res) => {
  console.log('✅ Received body:', req.body);
  const { name, email, password, referredBy = null } = req.body;

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

    // Referral logic
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

// ✅ LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        affiliateCode: user.affiliateCode
      }
    });
  } catch (err) {
    console.error('❌ Login Error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('./UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyToken = require('./verifyToken');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ✅ Register
router.post('/register', async (req, res) => {
  const { name, email, password, referredBy } = req.body;

  if (!name || !email || !password) {
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
      affiliateCode,
    });

    await user.save();

    // Optional referral logic
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.commissions += 10;
        await referrer.save();
      }
    }

    res.status(201).json({ message: 'User registered', affiliateCode });
  } catch (error) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ✅ Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      expiresIn: '7d',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        affiliateCode: user.affiliateCode,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in', details: error.message });
  }
});

// ✅ Logout (handled on client)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ✅ Protected Dashboard Route (auto-detect user from token)
router.get('/dashboard', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id); // From token
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts,
      referralCount: user.referralCount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

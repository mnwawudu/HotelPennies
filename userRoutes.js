const express = require('express');
const router = express.Router();
const User = require('./UserModel'); // Root-level model path
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ✅ Register Route
router.post('/register', async (req, res) => {
  console.log('Received body:', req.body);
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
      affiliateCode
    });

    await user.save();

    // Handle referral
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.commissions += 10;
        await referrer.save();
      }
    }

    res.status(201).json({ message: 'User registered', affiliateCode });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ✅ Login Route
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ✅ Dashboard Route
router.get('/dashboard/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

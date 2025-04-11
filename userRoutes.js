const express = require('express');
const router = express.Router();
const User = require('./UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Generate referral code
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ✅ Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });

    req.userId = decoded.id;
    next();
  });
};

// ✅ Register Route
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
      affiliateCode,
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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        affiliateCode: user.affiliateCode,
      },
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ✅ Protected Dashboard Route
router.get('/dashboard/:id', verifyToken, async (req, res) => {
  try {
    if (req.userId !== req.params.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts,
    });
  } catch (err) {
    console.error('❌ Dashboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

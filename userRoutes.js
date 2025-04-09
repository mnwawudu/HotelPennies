const express = require('express');
const router = express.Router();
const User = require('./models/UserModel'); // ✅ Corrected to match file structure
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Helper: Generate affiliate code
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// POST /register
router.post('/register', async (req, res) => {
  const { name, email, password, referredBy } = req.body;

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

    // Credit referrer
    if (referredBy) {
      const referrer = await User.findOne({ affiliateCode: referredBy });
      if (referrer) {
        referrer.commissions += 10;
        await referrer.save();
      }
    }

    res.json({ message: 'User registered successfully', affiliateCode });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: 'Login error', error });
  }
});

// GET /dashboard/:id
router.get('/dashboard/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      name: user.name,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts,
    });
  } catch (error) {
    res.status(500).json({ message: 'Dashboard error', error });
  }
});

module.exports = router;

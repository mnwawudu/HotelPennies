const express = require('express');
const router = express.Router();
const User = require('./UserModel'); // ✅ Corrected casing
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123';

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const affiliateCode = Math.random().toString(36).substr(2, 8);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      referredBy,
      affiliateCode
    });

    await newUser.save();

    const token = jwt.sign({ userId: newUser._id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        affiliateCode: newUser.affiliateCode,
        referredBy: newUser.referredBy,
        commissions: newUser.commissions,
        payouts: newUser.payouts
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        affiliateCode: user.affiliateCode,
        referredBy: user.referredBy,
        commissions: user.commissions,
        payouts: user.payouts
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

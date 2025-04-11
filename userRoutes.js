const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./userModel'); // ✅ Corrected path
const authMiddleware = require('./middleware/authMiddleware');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const affiliateCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const user = new User({
      name,
      email,
      password: hashedPassword,
      affiliateCode,
      referredBy: referredBy || null,
    });

    await user.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req

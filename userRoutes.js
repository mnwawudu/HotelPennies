const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./userModel'); // <-- Corrected path
const authMiddleware = require('./middleware/authMiddleware');

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, referredBy } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    // Generate affiliate code
    const affiliateCode = Math.random().toString(36).substring(2, 8);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      referredBy: referredBy || null,
      affiliateCode
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      referredBy: user.referredBy,
      token,
      expiresIn: '7d'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message:

const express = require('express');
const router = express.Router();
const User = require('./UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Just logs the incoming data to verify the backend sees it correctly
router.post('/register', async (req, res) => {
  console.log('Received body:', req.body); // ✅ LOG INPUT

  const { name, email, password, referredBy } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'User already exists' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const affiliateCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  const user = new User({
    name,
    email,
    password: hashedPassword,
    referredBy,
    affiliateCode
  });

  await user.save();

  if (referredBy) {
    const referrer = await User.findOne({ affiliateCode: referredBy });
    if (referrer) {
      referrer.commissions += 10;
      await referrer.save();
    }
  }

  res.json({ message: 'User registered', affiliateCode });
});

module.exports = router;

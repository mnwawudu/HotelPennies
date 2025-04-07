const express = require('express');
const router = express.Router();
const User = require('../UserModel');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

router.post('/register', async (req, res) => {
  const { name, email, password, referredBy } = req.body;

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

  if (referredBy) {
    const referrer = await User.findOne({ affiliateCode: referredBy });
    if (referrer) {
      referrer.commissions += 10;
      await referrer.save();
    }
  }

  res.json({ message: 'User registered', affiliateCode });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token, user });
});

router.get('/dashboard/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json({
    name: user.name,
    affiliateCode: user.affiliateCode,
    commissions: user.commissions,
    payouts: user.payouts
  });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./userModel');

const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123';

// Middleware to verify token and attach user info
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralCount = await User.countDocuments({ referredBy: user.affiliateCode });

    res.json({
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts,
      referralCount,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

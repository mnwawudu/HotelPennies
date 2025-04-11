const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./UserModel');

const JWT_SECRET = process.env.JWT_SECRET || 'mySuperSecretKey123';

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) return res.status(403).json({ message: 'No token provided' });

  const token = bearerHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Invalid token' });
    req.userId = decoded.userId || decoded.id;
    next();
  });
};

// Dashboard route
router.get('/', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const referrals = await User.find({ referredBy: user.affiliateCode });
    const referralCount = referrals.length;
    const commission = referralCount * 1000;

    res.json({
      user: {
        name: user.name,
        email: user.email,
        affiliateCode: user.affiliateCode,
      },
      referralCount,
      commission
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong' });
  }
});

module.exports = router;

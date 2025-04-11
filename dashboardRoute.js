const express = require('express');
const router = express.Router();
const User = require('./userModel');

// Simulated auth middleware for testing
const authenticateUser = (req, res, next) => {
  req.user = { email: req.query.email };
  console.log('✅ Dashboard route hit. Email:', req.user.email); // For debug
  next();
};

router.get('/dashboard', authenticateUser, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const referralCount = await User.countDocuments({
      referredBy: user.affiliateCode,
    });

    res.json({
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      commissions: user.commissions,
      payouts: user.payouts,
      referralCount,
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

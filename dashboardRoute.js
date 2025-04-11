// dashboardRoute.js
const express = require('express');
const router = express.Router();
const User = require('./userModel'); // stays in root
const authenticateToken = require('./authMiddleware'); // also in root

router.get('/api/dashboard', authenticateToken, async (req, res) => {
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

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('./UserModel'); // ✅ Ensure casing matches filename
const authMiddleware = require('./authMiddleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get referral count
    const referralCount = await User.countDocuments({ referredBy: user.affiliateCode });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      referredBy: user.referredBy,
      referralCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

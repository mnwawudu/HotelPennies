const express = require('express');
const router = express.Router();
const User = require('./userModel'); // ✅ Correct path if userModel.js is at root
const authMiddleware = require('./authMiddleware'); // Adjusted path

// Payout route - user must be authenticated
router.post('/', authMiddleware, async (req, res) => {
  const { amount } = req.body;

  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.commissions < amount) {
      return res.status(400).json({ message: 'Insufficient commission balance' });
    }

    user.commissions -= amount;
    user.payouts += amount;

    await user.save();

    res.status(200).json({ message: 'Payout successful', newBalance: user.commissions });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

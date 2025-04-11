const express = require('express');
const router = express.Router();
const User = require('./models/userModel'); // ✅ Corrected path
const authMiddleware = require('./middleware/authMiddleware'); // ✅ If using auth

// Payout route - user must be authenticated
router.post('/', authMiddleware, async (req, res) => {
  const { amount } = req.body;

  try {
    const user = await User.findById(req.user.id); // from middleware

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user has enough commission
    if (user.commissions < amount) {
      return res.status(400).json({ message: 'Insufficient commission balance' });
    }

    // Deduct amount
    user.commissions -= amount;

    // Increment payouts
    user.payouts += amount;

    await user.save();

    res.status(200).json({ message: 'Payout successful', newBalance: user.commissions });
  } catch (error) {
    console.error('Payout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

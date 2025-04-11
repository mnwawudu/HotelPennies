const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/auth');
const Payout = require('./models/payoutModel');

// ✅ POST a new payout
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount, status } = req.body;

    const newPayout = new Payout({
      userId: req.user.id, // Extracted from the token
      amount,
      status: status || 'pending',
    });

    await newPayout.save();
    res.status(201).json(newPayout);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ GET all payouts for a user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

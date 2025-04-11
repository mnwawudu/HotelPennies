const express = require('express');
const router = express.Router();
const authMiddleware = require('./middleware/auth'); // adjust path if needed
const Payout = require('./models/payoutModel');

// ✅ Set minimum payout amount (₦5000)
const MIN_PAYOUT_AMOUNT = 5000;

// 🚀 Create a payout request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    // ✅ Check if amount is at least ₦5000
    if (amount < MIN_PAYOUT_AMOUNT) {
      return res.status(400).json({ message: `Minimum payout amount is ₦${MIN_PAYOUT_AMOUNT}` });
    }

    const newPayout = new Payout({
      userId: req.user.id,
      amount,
      status: 'pending',
      dateRequested: new Date()
    });

    await newPayout.save();
    res.status(201).json(newPayout);
  } catch (err) {
    console.error('Payout creation error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

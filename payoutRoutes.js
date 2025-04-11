// routes/payoutRoutes.js
const express = require('express');
const router = express.Router();
const Payout = require('./models/payoutModel'); // ✅ Adjust this path if needed
const authMiddleware = require('./middleware/auth');

// ✅ GET all payouts for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const payouts = await Payout.find({ user: req.user.id });
    res.json(payouts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ POST a new payout
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount, status } = req.body;

    const newPayout = new Payout({
      user: req.user.id,
      amount,
      status: status || 'pending',
    });

    await newPayout.save();
    res.status(201).json(newPayout);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;

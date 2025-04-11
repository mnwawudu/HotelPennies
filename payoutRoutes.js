const express = require('express');
const router = express.Router();
const Payout = require('./models/payoutModel');
const authMiddleware = require('./middleware/auth');

// Create a new payout request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount < 5000) {
      return res.status(400).json({ message: 'Minimum payout amount is ₦5000' });
    }

    const payout = new Payout({
      userId: req.user.id,
      amount,
      status: 'pending',
      dateRequested: new Date(),
    });

    const savedPayout = await payout.save();
    res.status(201).json(savedPayout);
  } catch (err) {
    console.error('Error creating payout:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all payouts for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const payouts = await Payout.find({ userId }).sort({ dateRequested: -1 });

    res.json({ payouts });
  } catch (err) {
    console.error('Error fetching payouts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

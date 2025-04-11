const express = require('express');
const router = express.Router();
const Payout = require('./models/payoutModel');
const User = require('./models/userModel'); // ✅ Corrected path
const authMiddleware = require('./middleware/auth');

// Create a new payout request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;

    if (amount < 5000) {
      return res.status(400).json({ message: 'Minimum payout amount is ₦5000' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.commissions < amount) {
      return res.status(400).json({ message: 'Insufficient commission balance for payout' });
    }

    const payout = new Payout({
      userId: req.user.id,
      amount,
      status: 'pending',
      createdAt: new Date(),
    });

    await payout.save();

    // Deduct payout amount from commissions and increment payouts
    user.commissions -= amount;
    user.payouts += amount;
    await user.save();

    res.status(201).json({ message: 'Payout request submitted successfully', payout });
  } catch (err) {
    console.error('Error creating payout:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all payouts for the logged-in user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ payouts });
  } catch (err) {
    console.error('Error fetching payouts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

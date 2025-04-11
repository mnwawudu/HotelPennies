// payoutRoutes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('./middleware/auth'); // ✅ Corrected path
const Payout = require('./models/payoutModel');

// GET payouts for logged-in user
router.get('/', verifyToken, async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(payouts);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    res.status(500).json({ message: 'Failed to fetch payouts' });
  }
});

module.exports = router;

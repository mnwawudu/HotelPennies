// bookingRoutes.js
const express = require('express');
const router = express.Router();

// POST /api/bookings
router.post('/', async (req, res) => {
  const { userId, itemId, type, price, includeRide } = req.body;

  // Basic validation
  if (!userId || !itemId || !type || !price) {
    return res.status(400).json({ error: 'Missing required booking fields' });
  }

  // Add ride cost if selected
  const rideCost = includeRide ? 10000 : 0; // fixed ride cost
  const totalPrice = price + rideCost;

  // Respond with booking summary (mock behavior)
  res.json({
    message: `${type} booking created`,
    userId,
    itemId,
    type,
    totalPrice,
    rideIncluded: includeRide
  });
});

module.exports = router;

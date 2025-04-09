const express = require('express');
const router = express.Router();
const Booking = require('./bookingModel');

router.post('/create', async (req, res) => {
  try {
    const {
      userId,
      type,
      propertyId,
      date,
      baseCost,
      rideRequested,
      pickupLocation
    } = req.body;

    const rideCost = rideRequested ? 5000 : 0;
    const totalCost = baseCost + rideCost;

    const booking = new Booking({
      userId,
      type,
      propertyId,
      date,
      baseCost,
      rideRequested,
      pickupLocation,
      rideCost,
      totalCost
    });

    await booking.save();

    res.status(201).json({ message: 'Booking successful', booking });
  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ message: 'Booking failed', error: err.message });
  }
});

module.exports = router;

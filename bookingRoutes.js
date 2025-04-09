const express = require('express');
const router = express.Router();

// Sample in-memory booking data (replace with database later)
let bookings = [];

// Create a new booking
router.post('/', (req, res) => {
  const booking = req.body;
  booking.id = Date.now().toString(); // Temporary ID
  bookings.push(booking);
  res.status(201).json({ message: 'Booking created', booking });
});

// Get all bookings
router.get('/', (req, res) => {
  res.json(bookings);
});

// Get a specific booking by ID
router.get('/:id', (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' });
  }
  res.json(booking);
});

module.exports = router;

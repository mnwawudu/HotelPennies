const express = require('express');
const router = express.Router();

// In-memory storage (you can connect to DB later)
let bookings = [];

// Create booking
router.post('/', (req, res) => {
  const booking = req.body;
  booking.id = Date.now().toString();
  bookings.push(booking);
  res.status(201).json({ message: 'Booking created', booking });
});

// Get all bookings
router.get('/', (req, res) => {
  res.json(bookings);
});

// Get booking by ID
router.get('/:id', (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  res.json(booking);
});

module.exports = router;

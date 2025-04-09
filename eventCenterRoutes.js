const express = require('express');
const router = express.Router();

// Dummy data for demonstration
let eventCenters = [
  {
    id: 1,
    name: 'Grand Hall',
    location: 'Downtown',
    price: 150000
  },
  {
    id: 2,
    name: 'Ocean View Pavilion',
    location: 'Beachside',
    price: 200000
  }
];

// GET all event centers
router.get('/', (req, res) => {
  res.json(eventCenters);
});

// POST a new event center
router.post('/', (req, res) => {
  const { name, location, price } = req.body;
  const newCenter = {
    id: eventCenters.length + 1,
    name,
    location,
    price
  };
  eventCenters.push(newCenter);
  res.status(201).json({ message: 'Event center added', data: newCenter });
});

module.exports = router;

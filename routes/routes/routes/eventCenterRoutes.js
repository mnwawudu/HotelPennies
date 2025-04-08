const express = require('express');
const router = express.Router();

// In-memory array to store event centers (temporary)
const eventCenters = [];

// Create a new event center
router.post('/', (req, res) => {
  const eventCenter = req.body;
  eventCenters.push(eventCenter);
  res.status(201).json(eventCenter);
});

// Get all event centers
router.get('/', (req, res) => {
  res.json(eventCenters);
});

module.exports = router;

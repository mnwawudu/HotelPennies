// routes/eventCenterRoutes.js
const express = require('express');
const router = express.Router();

const eventCenters = [];

router.post('/', (req, res) => {
  const eventCenter = req.body;
  eventCenters.push(eventCenter);
  res.status(201).json(eventCenter);
});

router.get('/', (req, res) => {
  res.json(eventCenters);
});

module.exports = router;

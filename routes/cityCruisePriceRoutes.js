const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const CityCruisePrice = require('../models/cityCruisePriceModel');

// GET /api/citycruise-prices/prices
router.get('/prices', async (req, res) => {
  try {
    const all = await CityCruisePrice.find({}); // Get all
    const durations = {};

    all.forEach((item) => {
      durations[item.duration] = item.price;
    });

    res.json({ durations });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load prices' });
  }
});

// POST /api/citycruise-prices/prices
router.post('/prices', adminAuth, async (req, res) => {
  const { duration, price } = req.body;

  if (!duration || !price) {
    return res.status(400).json({ message: 'Duration and price are required' });
  }

  try {
    const existing = await CityCruisePrice.findOne({ duration });

    if (existing) {
      existing.price = price;
      await existing.save();
      return res.json({ message: 'Price updated' });
    }

    await CityCruisePrice.create({ duration, price });
    res.status(201).json({ message: 'Price added' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to save price' });
  }
});

module.exports = router;

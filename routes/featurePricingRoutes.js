const express = require('express');
const router = express.Router();
const FeaturePricing = require('../models/featurePricingModel');

// Keep these in the route so validation is explicit even if the model changes
const ALLOWED_TYPES = ['local', 'global'];            // scope
const ALLOWED_DURATIONS = ['7d', '1m', '6m', '1y'];   // plans

// GET all pricing
router.get('/', async (_req, res) => {
  try {
    const pricing = await FeaturePricing.find()
      .sort({ type: 1, duration: 1 })
      .lean();
    res.json(pricing);
  } catch (error) {
    console.error('[feature-pricing] GET error:', error);
    res.status(500).json({ message: 'Failed to fetch pricing' });
  }
});

// CREATE/UPDATE (upsert) pricing for (type, duration)
router.post('/', async (req, res) => {
  try {
    const type = String(req.body.type || '').toLowerCase().trim();
    const duration = String(req.body.duration || '').toLowerCase().trim();
    const priceNum = Number(req.body.price);

    if (!ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid type. Allowed: ${ALLOWED_TYPES.join(', ')}` });
    }
    if (!ALLOWED_DURATIONS.includes(duration)) {
      return res.status(400).json({ message: `Invalid duration. Allowed: ${ALLOWED_DURATIONS.join(', ')}` });
    }
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return res.status(400).json({ message: 'Price must be a non-negative number.' });
    }

    const doc = await FeaturePricing.findOneAndUpdate(
      { type, duration },
      { $set: { price: priceNum } },
      { new: true, upsert: true, runValidators: true }
    );

    res.json(doc);
  } catch (error) {
    console.error('[feature-pricing] POST error:', error);
    const msg =
      error?.code === 11000
        ? 'Duplicate (type, duration) price already exists.'
        : error?.message || 'Failed to save pricing';
    res.status(500).json({ message: msg });
  }
});

module.exports = router;

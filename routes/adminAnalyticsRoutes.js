// routes/adminAnalyticsRoutes.js
'use strict';

const express = require('express');
const router = express.Router();

// ✅ Import models
const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');

// ✅ Auth middleware — fall back to no-op in dev if not found
let ensureAdmin = (_req, _res, next) => next();
try {
  ensureAdmin = require('../middleware/adminAuth');
} catch (e) {
  console.warn('adminAnalyticsRoutes: adminAuth middleware not found; using no-op (dev only).');
}

// ───────────────────────────────────────────────
// GET /api/admin/explore-counts
// Returns counts of featured listings by type
// ───────────────────────────────────────────────
router.get('/explore-counts', ensureAdmin, async (_req, res) => {
  try {
    const [hotels, shortlets, restaurants, eventcenters] = await Promise.all([
      Hotel.countDocuments({}),
      Shortlet.countDocuments({}),
      Restaurant.countDocuments({}),
      EventCenter.countDocuments({}),
    ]);

    const total = hotels + shortlets + restaurants + eventcenters;
    res.json({ hotels, shortlets, restaurants, eventcenters, total });
  } catch (e) {
    console.error('adminAnalyticsRoutes explore-counts error:', e);
    res.status(500).json({ message: 'Failed to load explore counts' });
  }
});

module.exports = router;

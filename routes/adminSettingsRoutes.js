// routes/adminSettings.js
const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Setting = require('../models/settingModel');
const configService = require('../services/configService');

/**
 * FRACTIONS in DB (0..1). If admin submits 15, we store 0.15.
 */
const KNOBS = {
  // lodging (hotels & shortlets)
  cashbackPctHotel:          { type: 'fraction', min: 0, max: 0.5 },
  referralPctHotel:          { type: 'fraction', min: 0, max: 0.5 },
  platformPctLodging:        { type: 'fraction', min: 0, max: 0.5 },

  // default (other)
  platformPctDefault:        { type: 'fraction', min: 0, max: 0.5 },

  // event center (NEW)
  cashbackPctEventCenter:    { type: 'fraction', min: 0, max: 0.5 },
  referralPctEventCenter:    { type: 'fraction', min: 0, max: 0.5 },
  platformPctEventCenter:    { type: 'fraction', min: 0, max: 0.5 },

  // flags
  platformMaturesWithVendor: { type: 'boolean' },
};

// Discoverable metadata for UIs
router.get('/knobs', adminAuth, async (_req, res) => {
  const cache = await configService.load(true);
  const pct = (f) => Number.isFinite(f) ? Math.round(f * 10000) / 100 : null; // to 2dp

  res.json({
    knobs: KNOBS,
    values: cache, // raw fractions in DB units
    percents: {
      cashbackPctHotel:       pct(cache.cashbackPctHotel),
      referralPctHotel:       pct(cache.referralPctHotel),
      platformPctLodging:     pct(cache.platformPctLodging),
      platformPctDefault:     pct(cache.platformPctDefault),

      cashbackPctEventCenter: pct(cache.cashbackPctEventCenter),
      referralPctEventCenter: pct(cache.referralPctEventCenter),
      platformPctEventCenter: pct(cache.platformPctEventCenter),
    },
  });
});

// GET current config (DB snapshot)
router.get('/', adminAuth, async (_req, res) => {
  const cache = await configService.load(true);
  res.json(cache);
});

// PUT update selected knobs (partial OK)
router.put('/', adminAuth, async (req, res) => {
  const updates = {};
  for (const [key, spec] of Object.entries(KNOBS)) {
    if (!(key in req.body)) continue;
    let val = req.body[key];

    if (spec.type === 'fraction') {
      let num = Number(val);
      if (!Number.isFinite(num)) {
        return res.status(400).json({ message: `Invalid number for ${key}` });
      }
      if (num > 1) num = num / 100; // allow 15 → 0.15
      if (num < spec.min || num > spec.max) {
        return res.status(400).json({ message: `${key} out of range (${spec.min}..${spec.max} as fraction)` });
      }
      updates[key] = num;
    } else if (spec.type === 'boolean') {
      const s = String(val).toLowerCase();
      updates[key] = ['1','true','yes','y','on'].includes(s);
    }
  }

  const ops = Object.entries(updates).map(([k, v]) =>
    Setting.updateOne({ key: k }, { $set: { value: v } }, { upsert: true })
  );
  await Promise.all(ops);

  // refresh in-memory cache immediately
  await configService.load(true);

  res.json({ ok: true, updates });
});

module.exports = router;

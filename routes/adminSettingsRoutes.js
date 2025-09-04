const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const Setting = require('../models/settingModel');
const configService = require('../services/configService');

/**
 * KNOBS — keep list SHORT and validated.
 * We store FRACTIONS (e.g., 0.02 for 2%) to avoid confusion.
 * If an admin submits 2 or "2", we normalize to 0.02.
 */
const KNOBS = {
  cashbackPctHotel:          { type: 'fraction', min: 0, max: 0.5 },  // 0..50%
  referralPctHotel:          { type: 'fraction', min: 0, max: 0.5 },
  platformPctLodging:        { type: 'fraction', min: 0, max: 0.5 },
  platformPctDefault:        { type: 'fraction', min: 0, max: 0.5 },
  platformMaturesWithVendor: { type: 'boolean' },
};

// 👉 NEW: discoverable metadata endpoint (used by some UIs)
router.get('/knobs', adminAuth, async (_req, res) => {
  const cache = await configService.load(true);
  const pct = (f) => Number.isFinite(f) ? Math.round(f * 10000) / 100 : null; // to 2dp

  res.json({
    knobs: KNOBS,
    values: cache,               // fractions in DB units
    percents: {                  // handy for UIs
      cashbackPctHotel: pct(cache.cashbackPctHotel),
      referralPctHotel: pct(cache.referralPctHotel),
      platformPctLodging: pct(cache.platformPctLodging),
      platformPctDefault: pct(cache.platformPctDefault),
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
      if (num > 1) num = num / 100; // allow 2 → 0.02
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

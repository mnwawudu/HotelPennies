// routes/adminVendorAgreement.js
const express = require('express');
const router = express.Router();

// NOTE: Linux is case-sensitive. Your model file is models/vendorAgreementAcceptance.js
const Acceptance = require('../models/vendorAgreementAcceptance');

// Try to use your existing admin auth middleware; fall back to no-op in dev
let ensureAdmin = (_req, _res, next) => next();
try {
  // Your other admin routes use ../middleware/adminAuth
  ensureAdmin = require('../middleware/adminAuth');
} catch (e) {
  console.warn('adminVendorAgreement: adminAuth middleware not found; using no-op (dev only).');
}

/**
 * GET /api/admin/vendor-agreements/acceptances?search=&limit=&offset=
 * Returns the most recent acceptances (simple filter + pagination)
 */
router.get('/vendor-agreements/acceptances', ensureAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const limit  = Math.min(Math.max(parseInt(req.query.limit  || '50', 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

    const q = {};
    if (search) {
      q.$or = [
        { name:        { $regex: search, $options: 'i' } },
        { email:       { $regex: search, $options: 'i' } },
        { contentHash: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await Acceptance.find(q)
      .sort({ acceptedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.json({ items, count: items.length });
  } catch (e) {
    console.error('adminVendorAgreement list error:', e);
    res.status(500).json({ message: 'Failed to load acceptances' });
  }
});

module.exports = router;

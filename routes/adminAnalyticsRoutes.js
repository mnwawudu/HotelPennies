const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const User = require('../models/userModel');

// --- Nigerian states (lowercased) with a few common variants
const NG_STATES = [
  'abia','adamawa','akwa ibom','anambra','bauchi','bayelsa','benue','borno','cross river',
  'delta','ebonyi','edo','ekiti','enugu','gombe','imo','jigawa','kaduna','kano','katsina',
  'kebbi','kogi','kwara','lagos','nasarawa','niger','ogun','ondo','osun','oyo','plateau',
  'rivers','sokoto','taraba','yobe','zamfara','fct','abuja','f.c.t'
];

// simple word-boundary regex tester
const makeWordMatcher = (needle) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i');

const normalize = (s) =>
  String(s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^./, c => c.toUpperCase()) // capitalize first char
    .toLowerCase()
    .replace(/^./, c => c.toUpperCase()); // final title-ish

const guessStateFromAddress = (addr = '') => {
  const a = String(addr || '').toLowerCase();
  if (!a) return null;

  // Fast path for Lagos/Abuja which appear very often
  if (/\blagos\b/.test(a)) return 'Lagos';
  if (/\babuj[ae]?\b|\bfct\b|\bf\.?c\.?t\.?\b/.test(a)) return 'FCT';

  for (const st of NG_STATES) {
    if (makeWordMatcher(st).test(a)) {
      // normalize special cases
      if (st === 'fct' || st === 'f.c.t' || st === 'abuja') return 'FCT';
      return st.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
};

const guessCityFromAddress = (addr = '') => {
  const a = String(addr || '').trim();
  if (!a) return null;
  // naive: take the first segment before a comma
  const first = a.split(',')[0].trim();
  // ignore super short or generic tokens
  if (!first || first.length < 3) return null;
  return first.charAt(0).toUpperCase() + first.slice(1);
};

// GET /api/admin/analytics/user-origins?limit=10
router.get('/analytics/user-origins', adminAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 10));

    // Fetch only fields we need
    const users = await User.find({}, 'state city address').lean();

    const stateCounts = new Map(); // Map<string, number>
    const cityCounts = new Map();

    const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);

    for (const u of users) {
      // STATE
      let st = (u.state || '').toString().trim();
      if (!st) st = guessStateFromAddress(u.address) || 'Unknown';
      else st = st.split(' ')
                  .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
                  .join(' ');
      bump(stateCounts, st);

      // CITY
      let ct = (u.city || '').toString().trim();
      if (!ct) ct = guessCityFromAddress(u.address) || 'Unknown';
      else ct = ct.split(' ')
                  .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w)
                  .join(' ');
      bump(cityCounts, ct);
    }

    const sortTop = (map) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    const byState = sortTop(stateCounts).map(([state, count]) => ({ state, count }));
    const byCity  = sortTop(cityCounts).map(([city, count]) => ({ city, count }));

    res.json({ byState, byCity, totalUsers: users.length });
  } catch (err) {
    console.error('[admin analytics] user-origins error:', err);
    res.status(500).json({ message: 'Failed to compute user origins' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const User = require('../models/userModel');

// GET /api/admin/users
// Flat list for the Admin "User List" page
router.get('/users', adminAuth, async (_req, res) => {
  try {
    const docs = await User.find(
      {},
      // include arrays we need to compute values
      'name email phone state city referrals earnings createdAt'
    )
      .sort({ createdAt: -1 })
      .lean();

    const users = docs.map((u) => {
      const referralsCount = Array.isArray(u.referrals) ? u.referrals.length : Number(u.referrals || 0);

      // Compute lifetime totalEarned from earnings (fallback-friendly)
      let totalEarned = 0;
      if (Array.isArray(u.earnings)) {
        for (const e of u.earnings) {
          const amt = Number(e?.amount || 0);
          const src = String(e?.source || '').toLowerCase();
          const status = String(e?.status || '').toLowerCase();

          if (src === 'booking' || src === 'transaction') {
            if (status !== 'reversed') totalEarned += amt;
          } else if (src === 'transaction_reversal' || src === 'referral_reversal') {
            totalEarned -= amt;
          }
        }
      } else if (typeof u.totalEarned === 'number') {
        totalEarned = Number(u.totalEarned || 0);
      }

      return {
        _id: u._id,
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        state: u.state || '',
        city: u.city || '',
        referrals: referralsCount,
        totalEarned,
        createdAt: u.createdAt,
      };
    });

    res.json(users);
  } catch (err) {
    console.error('[admin/users] error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// GET /api/admin/analytics/user-origins?limit=10
// Quick aggregate to power the "Top User Origins" widget
router.get('/analytics/user-origins', adminAuth, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

    const byState = await User.aggregate([
      { $group: { _id: { $ifNull: ['$state', 'Unknown'] }, count: { $sum: 1 } } },
      { $project: { _id: 0, state: '$_id', count: 1 } },
      { $sort: { count: -1, state: 1 } },
      { $limit: limit },
    ]);

    const byCity = await User.aggregate([
      {
        $group: {
          _id: {
            city: { $ifNull: ['$city', 'Unknown'] },
            state: { $ifNull: ['$state', ''] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          city: '$_id.city',
          state: '$_id.state',
          count: 1,
          label: {
            $cond: [
              { $eq: ['$_id.state', ''] },
              '$_id.city',
              { $concat: ['$_id.city', ', ', '$_id.state'] },
            ],
          },
        },
      },
      { $sort: { count: -1, label: 1 } },
      { $limit: limit },
    ]);

    const total = await User.countDocuments();

    res.json({ total, byState, byCity });
  } catch (err) {
    console.error('[admin/analytics/user-origins] error:', err);
    res.status(500).json({ message: 'Failed to compute user origins' });
  }
});

module.exports = router;

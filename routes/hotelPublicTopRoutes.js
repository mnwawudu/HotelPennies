// routes/hotelPublicTopRoutes.js
const express = require('express');
const router = express.Router();

const Hotel = require('../models/hotelModel');

/**
 * Shared aggregation pipeline builder for "Top Hotels"
 * We compute a robust composite score:
 * - Bayesian rating (prior mean 3.9, prior weight 20) + volume factor
 * - Bookings (log-scaled)
 * - Clicks (log-scaled)
 * - Small recency boost (90d)
 *
 * Final score:
 *   0.45 * ratingScore
 * + 0.40 * bookScore
 * + 0.10 * clickScore
 * + 0.05 * recency
 */
function buildTopPipeline({ city, state }) {
  const match = {};
  if (city)  match.city  = new RegExp(String(city).trim(), 'i');
  if (state) match.state = new RegExp(String(state).trim(), 'i');

  return [
    { $match: match },

    // Ensure numeric defaults
    {
      $addFields: {
        _avg:       { $ifNull: ['$avgRating', 0] },
        _rcnt:      { $ifNull: ['$ratingCount', 0] },
        _book:      { $ifNull: ['$bookingCount', 0] },
        _click:     { $ifNull: ['$clickCount', 0] },
        _createdAt: { $ifNull: ['$createdAt', new Date(0)] },
      }
    },

    // Bayesian average (prior mean 3.9, prior weight 20)
    {
      $addFields: {
        bayesAvg: {
          $divide: [
            { $add: [
              { $multiply: [3.9, 20] },
              { $multiply: ['$_avg', '$_rcnt'] }
            ]},
            { $add: [20, '$_rcnt'] }
          ]
        }
      }
    },

    // Component scores
    {
      $addFields: {
        // volume lifts confidence in rating up to ~50 reviews
        volFactor: { $min: [1, { $divide: ['$_rcnt', 50] }] },

        // ratings lead (quality * confidence)
        ratingScore: {
          $multiply: [
            { $divide: ['$bayesAvg', 5] },
            { $add: [0.6, { $multiply: [0.4, '$volFactor'] }] }
          ]
        },

        // bookings saturate ~50
        bookScore: {
          $min: [
            1,
            {
              $divide: [
                { $ln: { $add: [1, '$_book'] } },
                { $ln: 51 }
              ]
            }
          ]
        },

        // clicks saturate ~200
        clickScore: {
          $min: [
            1,
            {
              $divide: [
                { $ln: { $add: [1, '$_click'] } },
                { $ln: 201 }
              ]
            }
          ]
        },

        // tiny 90d boost so evergreen stars stay on top
        recency: {
          $cond: [
            { $gte: ['$_createdAt', new Date(Date.now() - 1000 * 60 * 60 * 24 * 90)] },
            1,
            0
          ]
        }
      }
    },

    // Composite score
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: [0.45, '$ratingScore'] },
            { $multiply: [0.40, '$bookScore'] },
            { $multiply: [0.10, '$clickScore'] },
            { $multiply: [0.05, '$recency'] }
          ]
        }
      }
    },

    // Primary sort by score, then strong tie-breakers
    {
      $sort: {
        score: -1,
        ratingScore: -1,
        bayesAvg: -1,
        _rcnt: -1,      // more reviews wins ties
        _book: -1,      // then bookings
        _click: -1,     // then clicks
        _createdAt: -1, // newest last tie-break
      }
    },

    // Keep fields generous so existing cards don't break
    {
      $project: {
        name: 1,
        city: 1,
        state: 1,
        address: 1,
        price: 1,
        promoPrice: 1,
        images: 1,
        photos: 1,
        featuredImage: 1,
        avgRating: '$_avg',
        ratingCount: '$_rcnt',
        bookingCount: '$_book',
        clickCount: '$_click',
        createdAt: '$_createdAt',

        // expose debug toggles (optionally projected later)
        bayesAvg: 1,
        ratingScore: 1,
        bookScore: 1,
        clickScore: 1,
        recency: 1,
        score: 1,
      }
    }
  ];
}

/**
 * GET /api/hotels/public/top
 * Returns top-N (default 8) hotels by composite score.
 * Optional query: ?limit=8&city=lagos&state=lagos&debug=1
 */
router.get('/public/top', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit || '8', 10), 1), 24);
    const city  = req.query.city || null;
    const state = req.query.state || null;
    const debug = String(req.query.debug || '').toLowerCase() === '1';

    const pipeline = buildTopPipeline({ city, state });
    pipeline.push({ $limit: limit });

    // Hide debug fields unless requested
    if (!debug) {
      pipeline.push({
        $project: {
          bayesAvg: 0, ratingScore: 0, bookScore: 0, clickScore: 0, recency: 0, score: 0
        }
      });
    }

    const rows = await Hotel.aggregate(pipeline);
    res.json({ rows, count: rows.length, debug });
  } catch (err) {
    console.error('top hotels error:', err);
    res.status(500).json({ message: 'Failed to load top hotels' });
  }
});

/**
 * GET /api/hotels/public/top/list
 * Paginated list for a “See more” page.
 * ?page=1&pageSize=12&city=&state=&debug=0
 */
router.get('/public/top/list', async (req, res) => {
  try {
    const page     = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '12', 10), 1), 50);
    const city     = req.query.city || null;
    const state    = req.query.state || null;
    const debug    = String(req.query.debug || '').toLowerCase() === '1';

    const pipeline = buildTopPipeline({ city, state });
    const countPipeline = pipeline.slice(0, -2).concat([{ $count: 'n' }]); // before projections

    // Page slice
    pipeline.push(
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize }
    );

    if (!debug) {
      pipeline.push({
        $project: {
          bayesAvg: 0, ratingScore: 0, bookScore: 0, clickScore: 0, recency: 0, score: 0
        }
      });
    }

    const [rows, totalArr] = await Promise.all([
      Hotel.aggregate(pipeline),
      Hotel.aggregate(countPipeline),
    ]);

    const total = totalArr?.[0]?.n || 0;
    res.json({
      rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      debug
    });
  } catch (err) {
    console.error('top hotels list error:', err);
    res.status(500).json({ message: 'Failed to load top hotels list' });
  }
});

module.exports = router;

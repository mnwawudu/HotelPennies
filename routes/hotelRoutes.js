const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotelModel');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // Cloudinary upload middleware

// Public: hotels with rooms, ranked by quality
router.get('/all-public', async (req, res) => {
  try {
    const hotels = await Hotel.find({ roomsCount: { $gt: 0 } })
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select(
        'name location city state mainImage images minPrice maxPrice averageRating bookingsCount ctr roomsCount createdAt'
      )
      .lean();

    res.json(hotels);
  } catch (err) {
    console.error('❌ Failed to fetch hotels:', err);
    res.status(500).json({ error: 'Failed to fetch public hotels' });
  }
});

// Public: hotel details
router.get('/public/:hotelId', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// Public: by city
router.get('/public/city/:city', async (req, res) => {
  try {
    const rawCity = (req.params.city || '').trim();
    if (!rawCity) return res.status(400).json({ error: 'City is required' });

    const filter = {
      city: new RegExp(`^${rawCity}$`, 'i'),
      roomsCount: { $gt: 0 },
    };

    if (Hotel.schema.path('isPublished')) filter.isPublished = true;

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip = (page - 1) * limit;

    const hotels = await Hotel.find(filter)
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select(
        'name location city state mainImage images minPrice maxPrice averageRating bookingsCount ctr roomsCount createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(hotels);
  } catch (err) {
    console.error('❌ Failed to fetch hotels by city:', err);
    res.status(500).json({ error: 'Failed to fetch hotels by city' });
  }
});

// Popular cities
router.get('/public/popular-cities', async (req, res) => {
  try {
    const result = await Hotel.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$city', hotelCount: { $sum: 1 } } },
      { $sort: { hotelCount: -1 } },
      { $limit: 6 },
    ]);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch popular cities' });
  }
});

// Featured
router.get('/public/featured', async (req, res) => {
  try {
    const featuredHotels = await Hotel.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(8);
    res.json(featuredHotels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured hotels' });
  }
});

// Vendor guard
const requireVendor = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (String(req.user.role || '').toLowerCase() !== 'vendor') {
    return res.status(403).json({ message: 'Access denied: vendors only' });
  }
  next();
};

// My hotels
router.get('/my-hotels', auth, requireVendor, async (req, res) => {
  try {
    const hotels = await Hotel.find({ vendorId: req.user._id });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// Hotel by id (vendor)
router.get('/:hotelId', auth, requireVendor, async (req, res) => {
  try {
    const hotel = await Hotel.findOne({
      _id: req.params.hotelId,
      vendorId: req.user._id,
    });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// Create hotel (with Cloudinary upload)
router.post(
  '/create',
  auth,
  requireVendor,
  upload.array('images'),
  async (req, res) => {
    try {
      // Cloudinary secure URLs
      const imageUrls = (req.files || []).map((f) => f.path);

      // Normalize + coerce
      const b = req.body || {};
      const num = (v) => (v === '' || v == null ? undefined : Number(v));

      // Amenities can arrive as amenities[], or JSON string "amenities"
      let amenities = [];
      if (Array.isArray(b['amenities[]'])) {
        amenities = b['amenities[]'];
      } else if (b['amenities[]']) {
        amenities = [b['amenities[]']];
      } else if (b.amenities) {
        try {
          const parsed = JSON.parse(b.amenities);
          if (Array.isArray(parsed)) amenities = parsed;
        } catch (_) {
          // ignore bad JSON; fall back to empty
        }
      }

      // Required fields check (fast feedback)
      const required = ['name', 'location', 'city', 'state', 'description'];
      const missing = required.filter((k) => !String(b[k] || '').trim());
      if (missing.length) {
        return res.status(400).json({
          ok: false,
          error: { message: `Missing required fields: ${missing.join(', ')}` },
        });
      }

      const doc = new Hotel({
        ...b, // keep your existing fields
        name: String(b.name).trim(),
        location: String(b.location).trim(),
        city: String(b.city).trim(),
        state: String(b.state).trim(),
        description: String(b.description).trim(),
        minPrice: num(b.minPrice),
        maxPrice: num(b.maxPrice),
        amenities,
        images: imageUrls,
        vendorId: req.user._id, // enforce vendor ownership
      });

      await doc.save();
      return res.status(201).json(doc);
    } catch (err) {
      const status = err?.name === 'ValidationError' ? 400 : 500;
      console.error('[Hotels/Create][ERROR]', {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      return res.status(status).json({
        ok: false,
        error: {
          name: err?.name || 'Error',
          message: err?.message || 'Failed to create hotel',
          code: err?.code || null,
        },
      });
    }
  }
);

// Update hotel
router.put('/:hotelId', auth, requireVendor, async (req, res) => {
  try {
    let updated;

    if (req.body.$push?.images) {
      updated = await Hotel.findOneAndUpdate(
        { _id: req.params.hotelId, vendorId: req.user._id },
        {
          $push: { images: req.body.$push.images },
          ...(req.body.mainImage && { mainImage: req.body.mainImage }),
        },
        { new: true }
      );
    } else {
      updated = await Hotel.findOneAndUpdate(
        { _id: req.params.hotelId, vendorId: req.user._id },
        req.body,
        { new: true }
      );
    }

    if (!updated) {
      return res.status(404).json({ error: 'Hotel not found or unauthorized' });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update hotel' });
  }
});

// Delete hotel
router.delete('/:hotelId', auth, requireVendor, async (req, res) => {
  try {
    const hotel = await Hotel.findOneAndDelete({
      _id: req.params.hotelId,
      vendorId: req.user._id,
    });

    if (!hotel)
      return res.status(404).json({ error: 'Hotel not found or unauthorized' });

    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete hotel' });
  }
});

module.exports = router;

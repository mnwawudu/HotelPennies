// routes/hotelRoutes.js
const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotelModel');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // Cloudinary upload middleware

// ---- Image fallback helper ------------------------------------
const FALLBACK_IMG = 'https://via.placeholder.com/800x600?text=Hotel';

function resolveDocImages(doc) {
  // Ensure images is an array
  const images = Array.isArray(doc.images) ? doc.images : [];
  // Prefer explicit mainImage, else first image, else placeholder
  const resolvedMain =
    (doc.mainImage && String(doc.mainImage)) ||
    (images[0] && String(images[0])) ||
    FALLBACK_IMG;

  // Mutate a shallow copy to avoid side effects on mongoose docs
  return {
    ...doc,
    images,
    mainImage: resolvedMain,
  };
}

// 🔒 Vendor guard
const requireVendor = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  if (String(req.user.role || '').toLowerCase() !== 'vendor') {
    return res.status(403).json({ message: 'Access denied: vendors only' });
  }
  next();
};

/**
 * ✅ Safe wrapper around multer so we see real errors
 *    and allow 0 files gracefully.
 */
const safeImagesUpload = (req, res, next) => {
  const cn = process.env.CLOUDINARY_CLOUD_NAME;
  const ck = process.env.CLOUDINARY_API_KEY;
  const cs = process.env.CLOUDINARY_API_SECRET;
  if (!cn || !ck || !cs) {
    const err = new Error('Cloudinary is not configured on this environment');
    err.status = 500;
    err.code = 'CLOUDINARY_CONFIG_MISSING';
    console.error('[Upload][config]', { cn: !!cn, ck: !!ck, cs: !!cs });
    return next(err);
  }

  return upload.array('images')(req, res, (err) => {
    if (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (!e.status) e.status = 400;
      console.error('[Upload][images] Multer/Cloudinary error:', {
        name: e.name,
        message: e.message,
        code: e.code,
        stack: e.stack,
      });
      return next(e);
    }
    if (!req.files) req.files = [];
    return next();
  });
};

// ---------------------------------------------------------------
// Public: hotels with rooms, ranked by quality
// ---------------------------------------------------------------
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

    const payload = (hotels || []).map(resolveDocImages);
    res.json(payload);
  } catch (err) {
    console.error('❌ Failed to fetch hotels:', err);
    res.status(500).json({ error: 'Failed to fetch public hotels' });
  }
});

// ---------------------------------------------------------------
// Public: hotel details
// ---------------------------------------------------------------
router.get('/public/:hotelId', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId).lean();
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(resolveDocImages(hotel));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// ---------------------------------------------------------------
// Public: by city
// ---------------------------------------------------------------
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

    const payload = (hotels || []).map(resolveDocImages);
    res.json(payload);
  } catch (err) {
    console.error('❌ Failed to fetch hotels by city:', err);
    res.status(500).json({ error: 'Failed to fetch hotels by city' });
  }
});

// ---------------------------------------------------------------
// Public: popular cities
// ---------------------------------------------------------------
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

// ---------------------------------------------------------------
// Public: featured
// ---------------------------------------------------------------
router.get('/public/featured', async (req, res) => {
  try {
    const featuredHotels = await Hotel.find({ isFeatured: true })
      .sort({ createdAt: -1 })
      .limit(8)
      .select(
        'name location city state mainImage images minPrice maxPrice averageRating bookingsCount ctr roomsCount createdAt'
      )
      .lean();

    const payload = (featuredHotels || []).map(resolveDocImages);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured hotels' });
  }
});

// ---------------------------------------------------------------
// Vendor: my hotels
// ---------------------------------------------------------------
router.get('/my-hotels', auth, requireVendor, async (req, res) => {
  try {
    const hotels = await Hotel.find({ vendorId: req.user._id })
      .select(
        'name location city state mainImage images minPrice maxPrice averageRating bookingsCount ctr roomsCount createdAt vendorId'
      )
      .lean();

    const payload = (hotels || []).map(resolveDocImages);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// ---------------------------------------------------------------
// Vendor: hotel by id
// ---------------------------------------------------------------
router.get('/:hotelId', auth, requireVendor, async (req, res) => {
  try {
    const hotel = await Hotel.findOne({
      _id: req.params.hotelId,
      vendorId: req.user._id,
    }).lean();

    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(resolveDocImages(hotel));
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// ---------------------------------------------------------------
// Vendor: create (with Cloudinary upload)
// ---------------------------------------------------------------
router.post('/create', auth, requireVendor, safeImagesUpload, async (req, res) => {
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
      } catch (_) {}
    }

    const required = ['name', 'location', 'city', 'state', 'description'];
    const missing = required.filter((k) => !String(b[k] || '').trim());
    if (missing.length) {
      return res.status(400).json({
        ok: false,
        error: { message: `Missing required fields: ${missing.join(', ')}` },
      });
    }

    const doc = new Hotel({
      ...b,
      name: String(b.name).trim(),
      location: String(b.location).trim(),
      city: String(b.city).trim(),
      state: String(b.state).trim(),
      description: String(b.description).trim(),
      minPrice: num(b.minPrice),
      maxPrice: num(b.maxPrice),
      amenities,
      images: imageUrls,
      vendorId: req.user._id,
    });

    await doc.save();

    // Ensure the response has a valid mainImage
    const plain = doc.toObject ? doc.toObject() : doc;
    return res.status(201).json(resolveDocImages(plain));
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
});

// ---------------------------------------------------------------
// Vendor: update
// ---------------------------------------------------------------
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
      ).lean();
    } else {
      updated = await Hotel.findOneAndUpdate(
        { _id: req.params.hotelId, vendorId: req.user._id },
        req.body,
        { new: true }
      ).lean();
    }

    if (!updated) {
      return res.status(404).json({ error: 'Hotel not found or unauthorized' });
    }

    res.json(resolveDocImages(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update hotel' });
  }
});

// ---------------------------------------------------------------
// Vendor: delete
// ---------------------------------------------------------------
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

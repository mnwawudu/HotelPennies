const express = require('express');
const router = express.Router();
const Hotel = require('../models/hotelModel');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // ✅ Cloudinary upload middleware



// ✅ Public access: only hotels that actually have rooms, ranked by quality
router.get('/all-public', async (req, res) => {
  try {
    const hotels = await Hotel.find(
      {
        // isPublished: true,    // ← Uncomment if you use a publish flag
        roomsCount: { $gt: 0 },  // hide hotels with no rooms
      }
    )
      .sort({
        averageRating: -1,  // ⭐ highest rated first
        bookingsCount: -1,  // 🧾 then most booked
        ctr: -1,            // 👀 then highest CTR (if present)
        createdAt: -1,      // ⏱️ newest as final tiebreak
      })
      // keep payload lean; include fields your card needs
      .select('name location city state mainImage images minPrice maxPrice averageRating bookingsCount ctr roomsCount createdAt')
      .lean();

    res.json(hotels);
  } catch (err) {
    console.error('❌ Failed to fetch hotels:', err);
    res.status(500).json({ error: 'Failed to fetch public hotels' });
  }
});


// ✅ Public access to hotel details (for image viewing)
router.get('/public/:hotelId', async (req, res) => {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json(hotel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get hotel' });
  }
});

// GET hotels by city (public) — ranked by quality & only hotels that have rooms
router.get('/public/city/:city', async (req, res) => {
  try {
    const rawCity = (req.params.city || '').trim();
    if (!rawCity) return res.status(400).json({ error: 'City is required' });

    // Base filter: exact city (case-insensitive) + must have rooms
    const filter = {
      city: new RegExp(`^${rawCity}$`, 'i'),
      roomsCount: { $gt: 0 },
    };

    // If your schema has isPublished, apply it
    if (Hotel.schema.path('isPublished')) filter.isPublished = true;

    // Optional pagination (safe defaults)
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip  = (page - 1) * limit;

    const hotels = await Hotel.find(filter)
      .sort({
        averageRating: -1,  // ⭐ highest rated
        bookingsCount: -1,  // 🧾 most booked
        ctr: -1,            // 👀 highest CTR
        createdAt: -1,      // ⏱️ newest as tiebreak
      })
      .select(
        'name location city state mainImage images minPrice maxPrice ' +
        'averageRating bookingsCount ctr roomsCount createdAt'
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


// ✅ Get top cities by number of hotels (for Popular Cities section)
router.get('/public/popular-cities', async (req, res) => {
  try {
    const result = await Hotel.aggregate([
      { $match: { isPublished: true } }, // Optional filter
      {
        $group: {
          _id: '$city',
          hotelCount: { $sum: 1 },
        },
      },
      { $sort: { hotelCount: -1 } },
      { $limit: 6 }, // or 12, if you want to show more
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch popular cities' });
  }
});

// ✅ Get featured hotels for homepage
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


// ✅ Only vendors can access these routes
const requireVendor = (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: 'Access denied: vendors only' });
  }
  next();
};

// ✅ Get Vendor's Hotels (⏫ moved ABOVE the dynamic route)
router.get('/my-hotels', auth, requireVendor, async (req, res) => {
  try {
    const hotels = await Hotel.find({ vendorId: req.user._id });
    res.json(hotels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hotels' });
  }
});

// ✅ Get Hotel by ID (vendor only)
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

// ✅ Create Hotel with image upload
router.post('/create', auth, requireVendor, upload.array('images'), async (req, res) => {
  try {
    const imageUrls = req.files.map(file => file.path); // Cloudinary returns secure URLs as `path`

    const hotel = new Hotel({
      ...req.body,
      vendorId: req.user._id,
      images: imageUrls,
    });

    await hotel.save();
    res.status(201).json(hotel);
  } catch (err) {
    console.error('❌ Error creating hotel:', err);
    res.status(500).json({ error: 'Failed to create hotel' });
  }
});

// ✅ Update hotel (mainImage, details, append images)
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

// ✅ Delete Hotel
router.delete('/:hotelId', auth, requireVendor, async (req, res) => {
  try {
    const hotel = await Hotel.findOneAndDelete({
      _id: req.params.hotelId,
      vendorId: req.user._id,
    });

    if (!hotel) return res.status(404).json({ error: 'Hotel not found or unauthorized' });

    res.json({ message: 'Hotel deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete hotel' });
  }
});

module.exports = router;

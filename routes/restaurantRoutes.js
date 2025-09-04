const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Restaurant = require('../models/restaurantModel');


// ─── GET ALL RESTAURANTS (PUBLIC) ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const allRestaurants = await Restaurant.find(
      // { isPublished: true } // ← uncomment if you gate by publish
    )
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select('name city state mainImage priceRange averageRating bookingsCount ctr createdAt')
      .lean();

    res.json(allRestaurants);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch restaurants' });
  }
});

// ─── GET BY CITY (PUBLIC) ──────────────────────────────────────────────────────
router.get('/public/city/:city', async (req, res) => {
  try {
    const city = (req.params.city || '').toLowerCase();

    const restaurants = await Restaurant.find({
      city: { $regex: new RegExp(`^${city}$`, 'i') }
      // , isPublished: true  // ← optional
    })
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select('name city state mainImage priceRange averageRating bookingsCount ctr createdAt')
      .lean();

    res.json(restaurants);
  } catch (err) {
    console.error('❌ Failed to fetch restaurants by city:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET SINGLE RESTAURANT (PUBLIC) ───────────────────────────────────────────

router.get('/public/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    console.error('❌ Failed to fetch restaurant:', err);
    res.status(500).json({ message: 'Failed to fetch restaurant' });
  }
});

// ✅ Middleware: Restrict to vendors only
const requireVendor = (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: 'Access denied: vendors only' });
  }
  next();
};

// ─── CREATE A RESTAURANT ──────────────────────────────────────────────────────

router.post('/', auth, requireVendor, upload.array('images'), async (req, res) => {
  try {
    const {
      name,
      cuisineType,
      location,
      priceRange,
      description,
      state,
      city,
      openingHours,            // ✅ New field
      termsAndConditions       // ✅ New field
    } = req.body;

    const images = req.files?.map(file => file.path) || [];

    const restaurant = new Restaurant({
      name,
      cuisineType,
      location,
      priceRange,
      description,
      state,
      city,
      images,
      vendorId: req.user._id,
      openingHours,
      termsAndConditions
    });

    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (err) {
    console.error('❌ Failed to create restaurant:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// ─── GET VENDOR RESTAURANTS ────────────────────────────────────────────────────
//
router.get('/my-listings', auth, requireVendor, async (req, res) => {
  try {
    const listings = await Restaurant.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('❌ Failed to fetch vendor restaurants:', err);
    res.status(500).json({ message: 'Failed to fetch vendor restaurants' });
  }
});


//
// ─── GET UNAVAILABLE DATES ─────────────────────────────────────────────────────

router.get('/:id/unavailable-dates', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    res.json({ unavailableDates: restaurant.unavailableDates || [] });
  } catch (err) {
    console.error('❌ Failed to fetch unavailable dates:', err);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});

//
// ─── UPDATE UNAVAILABLE DATES ──────────────────────────────────────────────────
//
router.put('/:id/unavailable-dates', auth, requireVendor, async (req, res) => {
  try {
    const { unavailableDates } = req.body;

    const updated = await Restaurant.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { unavailableDates },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Restaurant not found or unauthorized' });

    res.json({ message: 'Unavailable dates updated successfully' });
  } catch (err) {
    console.error('❌ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Failed to update unavailable dates' });
  }
});

//
// ─── GET SINGLE RESTAURANT BY ID ───────────────────────────────────────────────
//
router.get('/:id', auth, requireVendor, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
    });
    if (!restaurant) return res.status(404).json({ message: 'Not found or unauthorized' });
    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch restaurant' });
  }
});

//
// ─── UPDATE RESTAURANT DETAILS ─────────────────────────────────────────────────
//
router.put('/:id', auth, requireVendor, async (req, res) => {
  try {
    let updated;

    if (req.body.$push?.images) {
      updated = await Restaurant.findOneAndUpdate(
        { _id: req.params.id, vendorId: req.user._id },
        {
          $push: { images: req.body.$push.images },
          ...(req.body.mainImage && { mainImage: req.body.mainImage }),
        },
        { new: true }
      );
    } else {
      updated = await Restaurant.findOneAndUpdate(
        { _id: req.params.id, vendorId: req.user._id },
        req.body,
        { new: true }
      );
    }

    if (!updated) return res.status(404).json({ message: 'Restaurant not found or unauthorized' });

    res.json(updated);
  } catch (err) {
    console.error('❌ Failed to update restaurant:', err);
    res.status(500).json({ message: 'Failed to update restaurant' });
  }
});

//
// ─── DELETE RESTAURANT ─────────────────────────────────────────────────────────
//
router.delete('/:id', auth, requireVendor, async (req, res) => {
  try {
    const deleted = await Restaurant.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id,
    });

    if (!deleted) return res.status(404).json({ message: 'Not found or unauthorized' });

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (err) {
    console.error('❌ Delete failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

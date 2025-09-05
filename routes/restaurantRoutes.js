const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const Restaurant = require('../models/restaurantModel');


// â”€â”€â”€ GET ALL RESTAURANTS (PUBLIC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/', async (req, res) => {
  try {
    const allRestaurants = await Restaurant.find(
      // { isPublished: true } // â† uncomment if you gate by publish
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

// â”€â”€â”€ GET BY CITY (PUBLIC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/public/city/:city', async (req, res) => {
  try {
    const city = (req.params.city || '').toLowerCase();

    const restaurants = await Restaurant.find({
      city: { $regex: new RegExp(`^${city}$`, 'i') }
      // , isPublished: true  // â† optional
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
    console.error('âŒ Failed to fetch restaurants by city:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// â”€â”€â”€ GET SINGLE RESTAURANT (PUBLIC) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/public/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(restaurant);
  } catch (err) {
    console.error('âŒ Failed to fetch restaurant:', err);
    res.status(500).json({ message: 'Failed to fetch restaurant' });
  }
});

// âœ… Middleware: Restrict to vendors only
const requireVendor = (req, res, next) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: 'Access denied: vendors only' });
  }
  next();
};

// â”€â”€â”€ CREATE A RESTAURANT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      openingHours,            // âœ… New field
      termsAndConditions       // âœ… New field
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
    console.error('âŒ Failed to create restaurant:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

//
// â”€â”€â”€ GET VENDOR RESTAURANTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
router.get('/my-listings', auth, requireVendor, async (req, res) => {
  try {
    const listings = await Restaurant.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (err) {
    console.error('âŒ Failed to fetch vendor restaurants:', err);
    res.status(500).json({ message: 'Failed to fetch vendor restaurants' });
  }
});


//
// â”€â”€â”€ GET UNAVAILABLE DATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

router.get('/:id/unavailable-dates', async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    res.json({ unavailableDates: restaurant.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Failed to fetch unavailable dates:', err);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});

//
// â”€â”€â”€ UPDATE UNAVAILABLE DATES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.error('âŒ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Failed to update unavailable dates' });
  }
});

//
// â”€â”€â”€ GET SINGLE RESTAURANT BY ID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
// â”€â”€â”€ UPDATE RESTAURANT DETAILS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.error('âŒ Failed to update restaurant:', err);
    res.status(500).json({ message: 'Failed to update restaurant' });
  }
});

//
// â”€â”€â”€ DELETE RESTAURANT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    console.error('âŒ Delete failed:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


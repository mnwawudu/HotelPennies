const express = require('express');
const router = express.Router();
const Shortlet = require('../models/shortletModel');
const auth = require('../middleware/auth');

/**
 * Helper: include published OR docs where the field doesn't exist yet.
 * This makes the route tolerant while you migrate.
 */
const PUBLISHED_OR_MISSING = {
  $or: [{ isPublished: true }, { isPublished: { $exists: false } }],
};

//
// ðŸ”¹ PUBLIC ROUTES (No auth)
//

// âœ… Public shortlets: ranked by quality, fast, paginated, tolerant to missing isPublished
router.get('/public', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip = (page - 1) * limit;

    const filter = PUBLISHED_OR_MISSING; // ðŸ‘ˆ tolerant

    const shortlets = await Shortlet.find(filter)
      .sort({
        averageRating: -1,   // â­ highest rated
        bookingsCount: -1,   // ðŸ§¾ most booked
        ctr: -1,             // ðŸ‘€ highest CTR
        createdAt: -1,       // â±ï¸ newest as last tiebreak
      })
      .select(
        'title name mainImage images price promoPrice location city state averageRating bookingsCount ctr createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(shortlets);
  } catch (err) {
    console.error('âŒ Failed to fetch shortlets:', err);
    res.status(500).json({ message: 'Failed to fetch shortlets' });
  }
});

// âœ… Get shortlets by city (public, ranked, paginated, tolerant to missing isPublished)
router.get('/public/city/:city', async (req, res) => {
  try {
    const rawCity = (req.params.city || '').trim();
    if (!rawCity) return res.status(400).json({ message: 'City is required' });

    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip = (page - 1) * limit;

    const filter = {
      ...PUBLISHED_OR_MISSING, // ðŸ‘ˆ tolerant
      city: { $regex: `^${rawCity}$`, $options: 'i' },
    };

    const shortlets = await Shortlet.find(filter)
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select(
        'title name mainImage images price promoPrice location city state averageRating bookingsCount ctr createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(shortlets);
  } catch (err) {
    console.error('âŒ Failed to fetch shortlets by city:', err);
    res.status(500).json({ message: 'Failed to fetch shortlets by city' });
  }
});

// Get a shortlet by ID (public)
router.get('/public/:id', async (req, res) => {
  try {
    const shortlet = await Shortlet.findById(req.params.id);
    if (!shortlet) return res.status(404).json({ message: 'Shortlet not found' });
    res.json(shortlet);
  } catch (err) {
    console.error('âŒ Public shortlet fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch shortlet' });
  }
});

//
// ðŸ”¹ AUTHENTICATED VENDOR ROUTES
//

// Create a shortlet
router.post('/create', auth, async (req, res) => {
  try {
    const shortlet = new Shortlet({
      ...req.body,
      vendorId: req.user._id,
    });

    await shortlet.save();
    res.status(201).json({ message: 'Shortlet created', shortlet });
  } catch (err) {
    console.error('âŒ Shortlet creation error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get all shortlets by vendor
router.get('/my-listings', auth, async (req, res) => {
  try {
    const listings = await Shortlet.find({ vendorId: req.user._id });
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch vendor shortlets' });
  }
});

// Update shortlet details
router.put('/:id', auth, async (req, res) => {
  try {
    const shortlet = await Shortlet.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      req.body,
      { new: true }
    );
    if (!shortlet) return res.status(404).json({ message: 'Shortlet not found' });
    res.json({ message: 'Shortlet updated', shortlet });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// Add images
router.put('/:id/images', auth, async (req, res) => {
  try {
    const { newImages } = req.body;
    const updated = await Shortlet.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { $push: { images: { $each: newImages } } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload images' });
  }
});

// Set main image
router.put('/:id/main-image', auth, async (req, res) => {
  try {
    const { mainImage } = req.body;
    const updated = await Shortlet.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { mainImage },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update main image' });
  }
});

// Delete image
router.put('/:id/delete-image', auth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const updated = await Shortlet.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { $pull: { images: imageUrl } },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

// PUBLIC: get unavailable dates for a shortlet
router.get('/public/:id/unavailable-dates', async (req, res) => {
  try {
    const shortlet = await Shortlet.findById(req.params.id);
    if (!shortlet) {
      return res.status(404).json({ message: 'Shortlet not found' });
    }
    res.json({ unavailableDates: shortlet.unavailableDates || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching unavailable dates' });
  }
});

// GET unavailable dates (calendar)
router.get('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    const shortlet = await Shortlet.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
    });
    if (!shortlet) return res.status(404).json({ message: 'Shortlet not found' });

    res.json({ unavailableDates: shortlet.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Failed to fetch unavailable dates:', err);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});

// PUT unavailable dates
router.put('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    const { unavailableDates } = req.body;

    const shortlet = await Shortlet.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      { unavailableDates },
      { new: true }
    );

    if (!shortlet) return res.status(404).json({ message: 'Shortlet not found' });

    res.json({ message: 'Unavailable dates updated', shortlet });
  } catch (err) {
    console.error('âŒ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Failed to update unavailable dates' });
  }
});

// Delete a shortlet
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Shortlet.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id,
    });
    if (!result) return res.status(404).json({ message: 'Shortlet not found' });
    res.json({ message: 'Shortlet deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Delete failed' });
  }
});

//
// ðŸ”¹ CATCH-ALL AUTH ROUTE (MUST BE LAST)
//

// Get single shortlet (authenticated vendor only)
router.get('/:id', auth, async (req, res) => {
  try {
    const shortlet = await Shortlet.findOne({
      _id: req.params.id,
      vendorId: req.user._id,
    });
    if (!shortlet) return res.status(404).json({ message: 'Shortlet not found' });
    res.json(shortlet);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch shortlet' });
  }
});

module.exports = router;


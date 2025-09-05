// routes/tourGuideRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const TourGuide = require('../models/tourGuideModel');

/* ---------------------------
   PUBLIC ROUTES (no auth)
---------------------------- */

// âœ… Ranked, lean, paginated list (alias: /public AND /all-public)
async function fetchRankedGuides(req, res) {
  try {
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip  = (page - 1) * limit;

    // Donâ€™t hard-filter by isPublished unless youâ€™re certain it exists.
    // If you do use it, pass ?published=1 to enable.
    const filter = {};
    if (req.query.published === '1') filter.isPublished = true;

    const guides = await TourGuide.find(filter)
      .sort({
        averageRating: -1,   // â­ highest rated
        bookingsCount: -1,   // ðŸ§¾ most booked
        ctr: -1,             // ðŸ‘€ highest CTR
        createdAt: -1,       // â±ï¸ newest as tiebreak
      })
      .select(
        'name price promoPrice location city state language experience ' +
        'mainImage hostImage images averageRating bookingsCount ctr createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(guides);
  } catch (err) {
    console.error('âŒ Failed to fetch tour guides:', err);
    res.status(500).json({ message: 'Failed to fetch tour guides' });
  }
}

router.get('/public', fetchRankedGuides);
router.get('/all-public', fetchRankedGuides); // <- some frontends use this path

// âœ… Ranked by city (lean + paginated)
router.get('/public/city/:city', async (req, res) => {
  try {
    const rawCity = (req.params.city || '').trim();
    if (!rawCity) return res.status(400).json({ message: 'City is required' });

    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip  = (page - 1) * limit;

    const filter = { city: new RegExp(`^${rawCity}$`, 'i') };
    if (req.query.published === '1') filter.isPublished = true;

    const guides = await TourGuide.find(filter)
      .sort({
        averageRating: -1,
        bookingsCount: -1,
        ctr: -1,
        createdAt: -1,
      })
      .select(
        'name price promoPrice location city state language experience ' +
        'mainImage hostImage images averageRating bookingsCount ctr createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(guides);
  } catch (err) {
    console.error('âŒ Failed to fetch tour guides by city:', err);
    res.status(500).json({ message: 'Failed to fetch tour guides by city' });
  }
});

// âœ… Public detail
router.get('/public/:id', async (req, res) => {
  try {
    const guide = await TourGuide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Tour guide not found' });
    res.json(guide);
  } catch (err) {
    console.error('âŒ Public tour guide fetch error:', err);
    res.status(500).json({ message: 'Server error while fetching tour guide' });
  }
});

// âœ… Public unavailable dates
router.get('/:id/unavailable-dates', async (req, res) => {
  try {
    const guide = await TourGuide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Tour guide not found' });
    res.json({ unavailableDates: guide.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Failed to fetch unavailable dates:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* --------------------------------
   VENDOR ROUTES (auth required)
--------------------------------- */

// Create a Tour Guide (multipart)
router.post(
  '/',
  auth,
  upload.fields([
    { name: 'images', maxCount: 10 },
    { name: 'hostImage', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        name, price, location, city, state, language, experience,
        description, bio, mainImageIndex,
        promoPrice, usePromo, termsAndConditions
      } = req.body;

      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: 'At least one image is required.' });
      }

      const imageFiles = req.files['images'] || [];
      const hostImageFile = req.files['hostImage']?.[0]?.path || '';

      const imageUrls = imageFiles.map(file => file.path);
      const mainIndex = parseInt(mainImageIndex || 0, 10);
      const mainImage = imageUrls[mainIndex] || imageUrls[0];

      const newGuide = new TourGuide({
        name,
        price,
        location,
        city,
        state,
        language,
        experience,
        description,
        bio,
        hostImage: hostImageFile,
        vendorId: req.user._id,
        images: imageUrls,
        mainImage,
        promoPrice: promoPrice || null,
        usePromo: String(usePromo) === 'true',
        termsAndConditions
      });

      await newGuide.save();
      res.status(201).json(newGuide);
    } catch (err) {
      console.error('âŒ Failed to create tour guide:', err);
      res.status(400).json({ error: 'Failed to create tour guide' });
    }
  }
);

// Admin/all (optional)
router.get('/', async (req, res) => {
  try {
    const guides = await TourGuide.find();
    res.json(guides);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch guides' });
  }
});

// Vendorâ€™s listings
router.get('/my-listings', auth, async (req, res) => {
  try {
    const guides = await TourGuide.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    res.json(guides);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch vendor guides' });
  }
});

/**
 * âœ… Update guide (JSON-friendly for UploadImageModal)
 * Supports:
 *   {$push: { images: { $each: [...] }}}  // append images
 *   {$pull: { images: 'https://...' }}    // delete one image
 *   { mainImage: 'https://...' }          // set cover image
 *   + normal scalar fields in body
 *
 * NOTE: no multer here â€” keeps JSON bodies intact.
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const update = {};
    const set = {};

    // Whitelisted scalar fields
    const allowedFields = [
      'name', 'price', 'location', 'city', 'state', 'language',
      'experience', 'description', 'promoPrice', 'usePromo',
      'mainImage', 'bio', 'complimentary', 'termsAndConditions'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        set[field] = req.body[field];
      }
    }

    if (Object.keys(set).length) update.$set = set;

    // pass-through array ops from UploadImageModal
    if (req.body.$push) update.$push = req.body.$push;
    if (req.body.$pull) update.$pull = req.body.$pull;

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const updated = await TourGuide.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      update,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: 'Tour guide not found' });
    res.json(updated);
  } catch (err) {
    console.error('tour-guides update error:', err);
    res.status(400).json({ error: 'Update failed', detail: err.message });
  }
});

// Delete guide
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await TourGuide.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id,
    });
    if (!result) return res.status(404).json({ message: 'Tour guide not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete guide' });
  }
});

// Reviews
router.post('/:id/reviews', auth, async (req, res) => {
  try {
    const { rating, comment, userName } = req.body;
    const guide = await TourGuide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Tour guide not found' });

    const review = {
      user: req.user._id,
      userName: userName || 'Anonymous',
      rating: Number(rating),
      comment,
    };
    guide.reviews.push(review);
    guide.averageRating =
      guide.reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / guide.reviews.length;

    await guide.save();
    res.status(201).json({ message: 'Review added' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to add review' });
  }
});

router.get('/:id/reviews', async (req, res) => {
  try {
    const guide = await TourGuide.findById(req.params.id).select('reviews');
    if (!guide) return res.status(404).json({ message: 'Tour guide not found' });
    res.json(guide.reviews || []);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reviews' });
  }
});

// Feature a guide
router.put('/:id/feature', auth, async (req, res) => {
  try {
    const { type, expiryDate } = req.body;
    const updated = await TourGuide.findOneAndUpdate(
      { _id: req.params.id, vendorId: req.user._id },
      {
        isFeatured: true,
        featureType: type,
        featureExpiresAt: expiryDate,
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Tour guide not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Failed to feature guide' });
  }
});

// Auth-only unavailable dates update
router.put('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    const guide = await TourGuide.findById(req.params.id);
    if (!guide) return res.status(404).json({ message: 'Tour guide not found' });

    guide.unavailableDates = req.body.unavailableDates || [];
    await guide.save();

    res.json({ message: 'Unavailable dates updated', unavailableDates: guide.unavailableDates });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;


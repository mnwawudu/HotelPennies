const express = require('express');
const router = express.Router();
const Cruise = require('../models/cruiseModel');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload'); // ✅ Cloudinary upload middleware

// ✅ Public: Fetch cruises with optional location filter
router.get('/public', async (req, res) => {
  try {
    const { location } = req.query;
    let query = {};

    if (location) {
      const regex = new RegExp(location, 'i');
      query = { $or: [{ city: regex }, { state: regex }] };
    }

    const cruises = await Cruise.find(query);
    res.json(cruises);
  } catch (err) {
    console.error('❌ Failed to fetch city cruises:', err);
    res.status(500).json({ message: 'Failed to fetch cruises' });
  }
});

// ✅ Create new cruise (Admin only)
router.post('/', adminAuth, async (req, res) => {
  try {
    const cruise = new Cruise(req.body);
    await cruise.save();
    res.status(201).json(cruise);
  } catch (err) {
    console.error('❌ Failed to create cruise:', err);
    res.status(400).json({ message: 'Failed to create cruise' });
  }
});

// ✅ Update cruise fully
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    console.log('🔄 Updating cruise with:', req.body);

    Object.assign(cruise, req.body);
    await cruise.save();

    res.json(cruise);
  } catch (err) {
    console.error('❌ Failed to update cruise:', err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// ✅ Delete cruise
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await Cruise.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Cruise not found' });
    res.status(200).json({ message: 'Cruise deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete cruise:', err);
    res.status(500).json({ message: 'Failed to delete cruise' });
  }
});

// ✅ Get single cruise
router.get('/:id', async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });
    res.json(cruise);
  } catch (err) {
    console.error('❌ Failed to fetch cruise:', err);
    res.status(500).json({ message: 'Failed to fetch cruise' });
  }
});

// ✅ Admin: Fetch all cruises
router.get('/', adminAuth, async (req, res) => {
  try {
    const cruises = await Cruise.find();
    res.json(cruises);
  } catch (err) {
    console.error('❌ Failed to fetch cruises:', err);
    res.status(500).json({ message: 'Failed to fetch cruises' });
  }
});

// ✅ Upload multiple images for cruise
router.post('/upload/:cruiseId', adminAuth, upload.array('images'), async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.cruiseId);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    if (!cruise.images) cruise.images = [];
    req.files.forEach((file) => cruise.images.push(file.path));

    await cruise.save();
    res.status(200).json({ message: 'Images uploaded successfully', images: cruise.images });
  } catch (err) {
    console.error('❌ Image upload failed:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// ✅ Optional: Delete a specific image
router.put('/image/:cruiseId', adminAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const cruise = await Cruise.findById(req.params.cruiseId);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    cruise.images = cruise.images.filter((img) => img !== imageUrl);
    await cruise.save();

    res.status(200).json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete image:', err);
    res.status(500).json({ message: 'Image deletion failed' });
  }
});

// ✅ Calendar: Save unavailable dates
router.put('/:id/unavailable-dates', adminAuth, async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    cruise.unavailableDates = req.body.unavailableDates || [];
    await cruise.save();

    res.status(200).json({ message: 'Unavailable dates updated successfully' });
  } catch (err) {
    console.error('❌ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Failed to update unavailable dates' });
  }
});

// ✅ Calendar: Fetch unavailable dates
router.get('/:id/unavailable-dates', adminAuth, async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    res.status(200).json({
      unavailableDates: cruise.unavailableDates || [],
    });
  } catch (err) {
    console.error('❌ Error fetching unavailable dates:', err);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});

// ✅ Submit a cruise review
router.post('/:id/reviews', async (req, res) => {
  try {
    const { rating, comment, name } = req.body;
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });

    const review = {
      name,
      rating: Number(rating),
      comment,
    };

    cruise.reviews.push(review);
    cruise.numReviews = cruise.reviews.length;
    cruise.rating =
      cruise.reviews.reduce((acc, r) => acc + r.rating, 0) / cruise.reviews.length;

    await cruise.save();
    res.status(201).json({ message: 'Review submitted' });
  } catch (err) {
    console.error('❌ Failed to submit review:', err);
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

// ✅ Fetch cruise (with reviews)
router.get('/public/:id', async (req, res) => {
  try {
    const cruise = await Cruise.findById(req.params.id);
    if (!cruise) return res.status(404).json({ message: 'Cruise not found' });
    res.json(cruise);
  } catch (err) {
    console.error('❌ Failed to fetch cruise:', err);
    res.status(500).json({ message: 'Failed to fetch cruise' });
  }
});

module.exports = router;

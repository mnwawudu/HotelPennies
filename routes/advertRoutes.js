// ✅ routes/adRoutes.js
const express = require('express');
const router = express.Router();
const Advert = require('../models/advertModel');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const cloudinary = require('../utils/cloudinary'); // ✅ Make sure this exists

// ✅ Create advert
router.post('/create', adminAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      link,
      state,
      city,
      scope,
      price,
      subscriptionPeriod,
      placement // ✅ include this
    } = req.body;

    const advert = new Advert({
      title,
      description,
      link,
      state,
      city,
      scope,
      price,
      subscriptionPeriod,
      featured: true,
      paidStatus: true,
      isActive: true,
      placement // ✅ save it to DB
    });

    await advert.save();
    res.status(201).json({ message: 'Ad created', advert });
  } catch (err) {
    console.error('Ad creation failed:', err);
    res.status(500).json({ message: 'Server error during ad creation' });
  }
});


// ✅ Upload Ad Image with Cloudinary
router.post('/upload/:id', adminAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const result = await cloudinary.uploader.upload(req.file.path); // ✅ Upload to Cloudinary

    const advert = await Advert.findByIdAndUpdate(
      req.params.id,
      { imageUrl: result.secure_url }, // ✅ Save Cloudinary URL
      { new: true }
    );

    if (!advert) return res.status(404).json({ message: 'Ad not found' });

    res.json({ message: 'Image uploaded', advert });
  } catch (err) {
    console.error('❌ Upload failed:', err);
    res.status(500).json({ message: 'Image upload error' });
  }
});

// ✅ Get featured ads
router.get('/featured', adminAuth, async (req, res) => {
  try {
    const featured = await Advert.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(featured);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch ads' });
  }
});

// ✅ Update advert by ID
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const updated = await Advert.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Ad not found' });
    res.json({ message: 'Ad updated', advert: updated });
  } catch (err) {
    console.error('❌ Failed to update ad:', err);
    res.status(500).json({ message: 'Server error during update' });
  }
});

// ✅ Optional: Get ad by ID
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const ad = await Advert.findById(req.params.id);
    if (!ad) return res.status(404).json({ message: 'Ad not found' });
    res.json(ad);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch ad' });
  }
});
// ✅ DELETE ad image
router.delete('/:id/image', adminAuth, async (req, res) => {
  try {
    const ad = await Advert.findById(req.params.id);
    if (!ad || !ad.image) {
      return res.status(404).json({ message: 'Image not found' });
    }

    // Optionally delete from Cloudinary if stored remotely
    ad.image = '';
    await ad.save();

    res.json({ message: 'Image deleted successfully' });
  } catch (err) {
    console.error('Image deletion failed:', err);
    res.status(500).json({ message: 'Failed to delete image' });
  }
});

// ✅ Public: Get featured ads for homepage
router.get('/public/featured', async (req, res) => {
  try {
    const featured = await Advert.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(featured);
  } catch (err) {
    console.error('❌ Failed to fetch public ads:', err);
    res.status(500).json({ message: 'Failed to fetch ads' });
  }
});


module.exports = router;

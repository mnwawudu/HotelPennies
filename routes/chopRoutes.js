const express = require('express');
const router = express.Router();
const Chop = require('../models/chopModel');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');

// ================================
// ✅ PUBLIC ROUTES — place first
// ================================

// ✅ GET all public chops (ranked + includes rating fields)
router.get('/public', async (req, res) => {
  try {
    const filter = { /* isPublished: true */ }; // keep/comment as you prefer

    const chops = await Chop.find(filter)
      .sort({
        averageRating: -1,  // ⭐ highest rated
        bookingsCount: -1,  // 🧾 most booked
        ctr: -1,            // 👀 highest CTR
        createdAt: -1,      // ⏱️ newest last
      })
      // ⬇️ IMPORTANT: include rating sources the card can use
      .select(
        'name mainImage price promo promoPrice hasDelivery complimentary ' +
        'rating averageRating reviews.rating bookingsCount ctr createdAt'
      )
      .lean();

    res.json(chops);
  } catch (err) {
    console.error('❌ Failed to fetch public chops:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ✅ GET single public chop by ID
router.get('/public/:id', async (req, res) => {
  try {
    const chop = await Chop.findById(req.params.id); // No .select() here!
    if (!chop) return res.status(404).json({ message: 'Chop not found' });
    res.json(chop); // ✅ Must return full object
  } catch (err) {
    console.error('❌ Failed to fetch chop:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// ================================
// ✅ ADMIN / AUTH ROUTES
// ================================

// ✅ Create a chop item
router.post('/', adminAuth, async (req, res) => {
  try {
    const newChop = new Chop(req.body);
    await newChop.save();
    res.json(newChop);
  } catch (err) {
    res.status(500).json({ message: 'Create failed' });
  }
});

// ✅ Get all chop items (admin view)
router.get('/', async (req, res) => {
  try {
    const chops = await Chop.find();
    res.json(chops);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch' });
  }
});

// ✅ Update chop
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const updatedChop = await Chop.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ chop: updatedChop });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

// ✅ Upload images from universal modal
router.post('/upload/:id', adminAuth, upload.array('images'), async (req, res) => {
  try {
    const chop = await Chop.findById(req.params.id);
    if (!chop) return res.status(404).json({ message: 'Chop not found' });

    const imageUrls = req.files.map(file => file.path);
    chop.images.push(...imageUrls);
    if (!chop.mainImage && imageUrls.length > 0) {
      chop.mainImage = imageUrls[0];
    }

    await chop.save();
    res.json({ message: 'Images uploaded', urls: imageUrls });
  } catch (err) {
    res.status(500).json({ message: 'Upload failed' });
  }
});

// ✅ GET unavailable dates
router.get('/:id/unavailable-dates', adminAuth, async (req, res) => {
  const chop = await Chop.findById(req.params.id);
  if (!chop) return res.status(404).json({ message: 'Chop not found' });
  res.json({ unavailableDates: chop.unavailableDates || [] });
});

// ✅ PUT unavailable dates
router.put('/:id/unavailable-dates', adminAuth, async (req, res) => {
  const { unavailableDates } = req.body;
  const chop = await Chop.findByIdAndUpdate(
    req.params.id,
    { unavailableDates },
    { new: true }
  );
  if (!chop) return res.status(404).json({ message: 'Chop not found' });
  res.json({ message: 'Unavailable dates updated', chop });
});

// ✅ DELETE a chop by ID
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const chop = await Chop.findByIdAndDelete(req.params.id);
    if (!chop) return res.status(404).json({ message: 'Chop not found' });
    res.json({ message: 'Chop deleted successfully' });
  } catch (err) {
    console.error('❌ Delete error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

// GET /api/chops/public/:id
router.get('/public/:id', async (req, res) => {
  try {
    const chop = await Chop.findById(req.params.id);
    res.json(chop);
  } catch (err) {
    res.status(404).json({ message: 'Chop not found' });
  }
});


module.exports = router;

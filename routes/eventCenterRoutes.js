const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const EventCenter = require('../models/eventCenterModel');
const EventCenterBooking = require('../models/eventCenterBookingModel');


//
// âœ… PUBLIC ROUTES (NO AUTH REQUIRED)
// --------------------------------------

// Get all public event centers, ranked by quality (rating â†’ bookings â†’ CTR â†’ newest)
router.get('/all-public', async (req, res) => {
  try {
    // simple, safe pagination (defaults keep your current UI behavior sane)
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip  = (page - 1) * limit;

    // If your schema has isPublished, we honor it; otherwise we don't filter on it
    const filter = {};
    if (EventCenter.schema.path('isPublished')) filter.isPublished = true;

    const events = await EventCenter.find(filter)
      .sort({
        averageRating: -1,  // â­ highest rated first
        bookingsCount: -1,  // ðŸ§¾ then most booked
        ctr: -1,            // ðŸ‘€ then highest CTR
        createdAt: -1,      // â±ï¸ newest last tiebreak
      })
      .select(
        'name mainImage images location city state capacity price promoPrice usePromo ' +
        'averageRating bookingsCount ctr createdAt'
      )
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(events);
  } catch (err) {
    console.error('âŒ Failed to fetch public event centers:', err);
    res.status(500).json({ error: 'Failed to fetch event centers' });
  }
});

// Optional: ranked-by-quality city page
router.get('/public/city/:city', async (req, res) => {
  try {
    const rawCity = (req.params.city || '').trim();
    if (!rawCity) return res.status(400).json({ error: 'City is required' });

    const filter = { city: new RegExp(`^${rawCity}$`, 'i') };
    if (EventCenter.schema.path('isPublished')) filter.isPublished = true;

    const items = await EventCenter.find(filter)
      .sort({ averageRating: -1, bookingsCount: -1, ctr: -1, createdAt: -1 })
      .select('name mainImage images location city state capacity price promoPrice usePromo averageRating bookingsCount ctr createdAt')
      .limit(50)
      .lean();

    res.json(items);
  } catch (err) {
    console.error('âŒ Failed to fetch city event centers:', err);
    res.status(500).json({ error: 'Failed to fetch event centers' });
  }
});


// Get single public event center by ID (âœ… includes unavailableDates)
router.get('/public/:id', async (req, res) => {
  try {
    const event = await EventCenter.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event Center not found' });

    res.json({
      _id: event._id,
      name: event.name,
      price: event.price,
      location: event.location,
      city: event.city,
      state: event.state,
      capacity: event.capacity,
      description: event.description,
      promoPrice: event.promoPrice,
      usePromo: event.usePromo,
      complimentary: event.complimentary,
      termsAndConditions: event.termsAndConditions || '',
      openingHours: event.openingHours || {},
      images: event.images || [],
      mainImage: event.mainImage || '',
      unavailableDates: event.unavailableDates || [] // âœ… Added
    });
  } catch (err) {
    console.error('âŒ Failed to fetch public event center:', err);
    res.status(500).json({ error: 'Failed to fetch event center' });
  }
});


//
// âœ… VENDOR-ONLY ROUTES (AUTH REQUIRED)
// --------------------------------------

// Create new event center
router.post('/', auth, upload.array('images'), async (req, res) => {
  try {
    const {
      name, price, location, city, state,
      capacity, description, mainImageIndex,
      promoPrice, usePromo, termsAndConditions, openingHours
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const imageUrls = req.files.map(file => file.path);
    const mainIndex = parseInt(mainImageIndex, 10);
    const mainImage = imageUrls[mainIndex] || imageUrls[0];

    const newEvent = new EventCenter({
      name,
      price,
      location,
      city,
      state,
      capacity,
      description,
      termsAndConditions,
      openingHours,
      vendorId: req.user._id,
      images: imageUrls,
      mainImage,
      featureType: 'local',
      promoPrice: promoPrice || null,
      usePromo: usePromo === 'true'
    });

    await newEvent.save();
    res.status(201).json(newEvent);
  } catch (err) {
    console.error('âŒ Failed to create event center:', err);
    res.status(400).json({ error: 'Failed to create event center' });
  }
});

// Get all event centers for logged-in vendor
router.get('/my-listings', auth, async (req, res) => {
  try {
    const events = await EventCenter.find({ vendorId: req.user._id }).sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error('âŒ Failed to fetch listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Update event center
router.put('/:id', auth, async (req, res) => {
  try {
    const updatePayload = {};

    if ('$push' in req.body || '$pull' in req.body) {
      Object.assign(updatePayload, req.body);
    } else {
      const allowedFields = [
        'name', 'price', 'location', 'city', 'state',
        'capacity', 'description', 'promoPrice', 'usePromo',
        'mainImage', 'images', 'termsAndConditions', 'openingHours'
      ];
      updatePayload.$set = {};
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updatePayload.$set[field] = req.body[field];
        }
      });
    }

    const updated = await EventCenter.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Event Center not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('âŒ Failed to update event center:', err);
    res.status(400).json({ error: 'Update failed' });
  }
});

// Get unavailable dates
router.get('/:id/unavailable-dates', async (req, res) => {
  try {
    const center = await EventCenter.findById(req.params.id);
    if (!center) return res.status(404).json({ error: 'Event center not found' });

    res.json({ unavailableDates: center.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Failed to fetch unavailable dates:', err);
    res.status(500).json({ error: 'Failed to fetch unavailable dates' });
  }
});

// Update unavailable dates
router.put('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    let { unavailableDates } = req.body;
    if (Array.isArray(unavailableDates)) {
      unavailableDates = unavailableDates.map(d => new Date(d));
    }

    const center = await EventCenter.findByIdAndUpdate(
      req.params.id,
      { $set: { unavailableDates } },
      { new: true }
    );

    if (!center) {
      return res.status(404).json({ error: 'Event center not found' });
    }

    res.json(center);
  } catch (err) {
    console.error('âŒ Failed to update unavailable dates:', err);
    res.status(500).json({ error: 'Failed to update unavailable dates' });
  }
});

// Get single event center by ID (protected)
router.get('/:id', auth, async (req, res) => {
  try {
    const event = await EventCenter.findById(req.params.id);
    if (!event) return res.status(404).json({ error: 'Event Center not found' });

    res.json({
      _id: event._id,
      name: event.name,
      price: event.price,
      location: event.location,
      city: event.city,
      state: event.state,
      capacity: event.capacity,
      description: event.description,
      promoPrice: event.promoPrice,
      usePromo: event.usePromo,
      complimentary: event.complimentary,
      termsAndConditions: event.termsAndConditions || '',
      openingHours: event.openingHours || {},
      images: event.images || [],
      mainImage: event.mainImage || '',
    });
  } catch (err) {
    console.error('âŒ Failed to fetch event center:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete event center
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await EventCenter.findOneAndDelete({
      _id: req.params.id,
      vendorId: req.user._id
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Event Center not found' });
    }

    res.json({ message: 'Event Center deleted successfully' });
  } catch (err) {
    console.error('âŒ Failed to delete event center:', err);
    res.status(500).json({ error: 'Failed to delete event center' });
  }
});

module.exports = router;


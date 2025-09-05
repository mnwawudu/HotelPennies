const express = require('express');
const router = express.Router();
const PickupDeliveryOption = require('../models/pickupDeliveryModel');
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

// âœ… Normalize state names
const normalizeState = (input) => {
  const map = {
    'imo': 'imo',
    'imo state': 'imo',
    'lagos': 'lagos',
    'lagos state': 'lagos',
    'fct': 'fct',
    'abuja': 'fct',
    'abuja fct': 'fct',
    'enugu': 'enugu',
    'enugu state': 'enugu',
    'rivers': 'rivers',
    'rivers state': 'rivers',
    // Add more as needed
  };

  return map[input.trim().toLowerCase()] || input.trim().toLowerCase();
};

// âœ… PUBLIC - Allow public to view delivery states
router.get('/', async (req, res) => {
  try {
    const options = await PickupDeliveryOption.find({ isActive: true });
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch delivery options' });
  }
});

// âœ… PUBLIC: Check delivery availability (case-insensitive matching)
router.get('/check-availability/:state/:businessType', async (req, res) => {
  try {
    const rawState = req.params.state;
    const businessType = req.params.businessType;
    const state = normalizeState(rawState);

    const available = await PickupDeliveryOption.exists({
      type: 'delivery',
      state: new RegExp(`^${state}$`, 'i'),
      businessType: new RegExp(`^${businessType}$`, 'i'),
      isActive: true
    });

    res.json({ available: !!available });
  } catch (err) {
    console.error('âŒ Availability check error:', err);
    res.status(500).json({ error: 'Failed to check delivery availability' });
  }
});

// âœ… PUBLIC: Fetch state-specific delivery options
router.get('/state/:state/:businessType', async (req, res) => {
  try {
    const rawState = req.params.state;
    const businessType = req.params.businessType;
    const state = normalizeState(rawState);

    const options = await PickupDeliveryOption.find({
      state: new RegExp(`^${state}$`, 'i'),
      businessType: new RegExp(`^${businessType}$`, 'i'),
      isActive: true
    }).sort({ price: 1 });

    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch state-specific delivery options' });
  }
});

// âœ… Admin: Fetch all active options for dashboard
router.get('/all', auth, adminOnly, async (req, res) => {
  try {
    const options = await PickupDeliveryOption.find({ isActive: true }).sort({ fromZone: 1, toZone: 1, price: 1 });
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch options' });
  }
});

// âœ… PUBLIC: Get by type and businessType
router.get('/:type/:businessType', async (req, res) => {
  try {
    const options = await PickupDeliveryOption.find({
      type: req.params.type,
      businessType: req.params.businessType,
      isActive: true
    }).sort({ fromZone: 1, toZone: 1, price: 1 });

    res.json(options);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch options' });
  }
});

// âœ… Admin: Add new delivery option
router.post('/', auth, adminOnly, async (req, res) => {
  const { type, businessType, state, fromZone, toZone, title, description, price } = req.body;

  if (
    !type || !businessType || !state || !title || !price ||
    (state.toLowerCase() === 'lagos' && (!fromZone || !toZone))
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const normalizedState = normalizeState(state);

    const query = {
      type,
      businessType,
      state: normalizedState,
      title
    };

    if (normalizedState === 'lagos') {
      query.fromZone = fromZone;
      query.toZone = toZone;
    }

    const exists = await PickupDeliveryOption.findOne(query);
    if (exists) {
      return res.status(409).json({ error: 'Option already exists for this route and title' });
    }

    const newOption = new PickupDeliveryOption({
      type,
      businessType,
      state: normalizedState,
      fromZone: normalizedState === 'lagos' ? fromZone : undefined,
      toZone: normalizedState === 'lagos' ? toZone : undefined,
      title,
      description,
      price
    });

    await newOption.save();
    res.status(201).json(newOption);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create option' });
  }
});

// âœ… Admin: Update delivery option
router.put('/:id', auth, adminOnly, async (req, res) => {
  const { type, businessType, state, fromZone, toZone, title, description, price } = req.body;

  if (
    !type || !businessType || !state || !title || !price ||
    (state.toLowerCase() === 'lagos' && (!fromZone || !toZone))
  ) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const normalizedState = normalizeState(state);

    const updateData = {
      type,
      businessType,
      state: normalizedState,
      title,
      description,
      price,
      fromZone: normalizedState === 'lagos' ? fromZone : undefined,
      toZone: normalizedState === 'lagos' ? toZone : undefined
    };

    const updated = await PickupDeliveryOption.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update option' });
  }
});

// âœ… Admin: Delete delivery option
router.delete('/:id', auth, adminOnly, async (req, res) => {
  try {
    await PickupDeliveryOption.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete option' });
  }
});

module.exports = router;


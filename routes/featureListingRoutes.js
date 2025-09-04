const express = require('express');
const router = express.Router();
const axios = require('axios');

const FeatureListing = require('../models/featureListingModel');
const auth = require('../middleware/Auth');

// MODELS
const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');
const TourGuide = require('../models/tourGuideModel');
const Chop = require('../models/chopModel');
const Gift = require('../models/giftModel');
const Room = require('../models/roomModel');
const RestaurantMenu = require('../models/restaurantMenuModel');

const getFeatureDuration = (duration) =>
  ({
    '7d': 7,
    '1m': 30,
    '6m': 180,
    '1y': 365,
  }[duration] || 7);

const normalizeResourceType = (pathLabel) => {
  const map = {
    shortlets: 'shortlet',
    restaurants: 'restaurant',
    eventcenters: 'eventcenter',
    tourguides: 'tourguide',
    chops: 'chop',
    gifts: 'gift',
    menus: 'menu',
    rooms: 'room',
  };
  return map[pathLabel] || 'room';
};

// ───────────────── helpers ─────────────────
async function getStateForResource(resourceType, resourceId) {
  try {
    switch (resourceType) {
      case 'room': {
        const room = await Room.findById(resourceId).populate('hotelId', 'state');
        return room?.hotelId?.state || null;
      }
      case 'menu': {
        const menu = await RestaurantMenu.findById(resourceId).populate('restaurantId', 'state');
        return menu?.restaurantId?.state || null;
      }
      case 'shortlet': {
        const doc = await Shortlet.findById(resourceId).select('state');
        return doc?.state || null;
      }
      case 'restaurant': {
        const doc = await Restaurant.findById(resourceId).select('state');
        return doc?.state || null;
      }
      case 'eventcenter': {
        const doc = await EventCenter.findById(resourceId).select('state');
        return doc?.state || null;
      }
      case 'tourguide': {
        const doc = await TourGuide.findById(resourceId).select('state');
        return doc?.state || null;
      }
      case 'chop': {
        const doc = await Chop.findById(resourceId).select('state');
        return doc?.state || null;
      }
      case 'gift': {
        const doc = await Gift.findById(resourceId).select('state');
        return doc?.state || null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Save Paid Feature (verification success path)
const handleFeatureListing = async (
  resourceId,
  vendorId,
  featureType,
  durationDays,
  res,
  resourceType = 'room'
) => {
  const now = new Date();

  try {
    // Reuse any unpaid draft (keeps your legacy UX)
    const query = { vendorId, featureType, resourceType, isPaid: false };
    let feature = await FeatureListing.findOne(query);

    if (!feature) {
      feature = new FeatureListing({ vendorId, featureType, resourceType, resourceId });
    }

    // Compute state for local features; null/undefined for global
    const scopeState =
      featureType === 'local' ? await getStateForResource(resourceType, resourceId) : undefined;

    feature.resourceId = resourceId;
    feature.resourceType = resourceType;
    feature.isPaid = true;
    feature.featuredFrom = now;
    feature.featuredTo = new Date(now.getTime() + durationDays * 86400000);
    feature.disabled = false;
    feature.state = scopeState || undefined;

    await feature.save();
    return res.status(200).json(feature);
  } catch (err) {
    return res
      .status(500)
      .json({ message: 'Internal server error in feature listing', error: err.message });
  }
};

// Create unpaid feature listing (vendor flow starts)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'vendor')
      return res.status(403).json({ message: 'Access denied: vendors only' });

    const { resourceId, featureType, resourceType } = req.body;

    const newFeature = new FeatureListing({
      vendorId: req.user._id,
      featureType,
      resourceType,
      resourceId,
      isPaid: false,
    });

    await newFeature.save();
    res.status(201).json({ message: 'Feature request submitted', feature: newFeature });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create feature request', error: err.message });
  }
});

// Payment Verification Routes
const addPaystackRoute = (pathLabel) => {
  router.post(`/paystack/${pathLabel}/verify/:reference`, auth, async (req, res) => {
    const { reference } = req.params;
    const { resourceId, featureType, duration } = req.body;

    try {
      const verifyRes = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        }
      );

      const data = verifyRes.data;
      if (data.status && data.data.status === 'success') {
        const durationDays = getFeatureDuration(duration);
        const resourceType = normalizeResourceType(pathLabel);
        await handleFeatureListing(
          resourceId,
          req.user._id,
          featureType,
          durationDays,
          res,
          resourceType
        );
      } else {
        return res.status(400).json({ message: 'Transaction verification failed' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Server error during Paystack verification' });
    }
  });
};

const addFlutterwaveRoute = (pathLabel) => {
  router.post(`/flutterwave/${pathLabel}/verify/:transactionId`, auth, async (req, res) => {
    const { transactionId } = req.params;
    const { resourceId, featureType, duration } = req.body;

    try {
      const verifyRes = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        { headers: { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}` } }
      );

      const data = verifyRes.data;
      if (data.status === 'success') {
        const durationDays = getFeatureDuration(duration);
        const resourceType = normalizeResourceType(pathLabel);
        await handleFeatureListing(
          resourceId,
          req.user._id,
          featureType,
          durationDays,
          res,
          resourceType
        );
      } else {
        return res.status(400).json({ message: 'Transaction verification failed' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Server error during Flutterwave verification' });
    }
  });
};

[
  'shortlets',
  'restaurants',
  'eventcenters',
  'tourguides',
  'chops',
  'gifts',
  'menus',
  'rooms',
].forEach((type) => {
  addPaystackRoute(type);
  addFlutterwaveRoute(type);
});

// ✅ Public Fetch Route (tightened)
router.get('/public', async (req, res) => {
  try {
    const st = String(req.query.state || '').trim();
    const now = new Date();

    // base active
    const baseMatch = {
      isPaid: true,
      disabled: { $ne: true },
      featuredFrom: { $lte: now },
      featuredTo: { $gte: now },
    };

    // Gate by scope
    let match = { ...baseMatch };
    if (st) {
      // Only Global or Local for that state
      match.$or = [
        { featureType: 'global' },
        { featureType: 'local', state: { $regex: new RegExp(`^${st}$`, 'i') } },
      ];
    } else {
      // No state provided -> GLOBAL only
      match.featureType = 'global';
    }

    const features = await FeatureListing.find(match).lean();

    const response = {
      hotels: [],
      shortlets: [],
      restaurants: [],
      eventcenters: [],
      tourguides: [],
      chops: [],
      gifts: [],
      rooms: [],
      menus: [],
    };

    for (const feature of features) {
      const type = feature.resourceType || 'room';
      const itemId = feature.resourceId;
      if (!itemId) continue;

      let model = null;
      let key = null;

      switch (type) {
        case 'room':
          model = Room;
          key = 'rooms';
          break;
        case 'menu':
          model = RestaurantMenu;
          key = 'menus';
          break;
        case 'shortlet':
          model = Shortlet;
          key = 'shortlets';
          break;
        case 'restaurant':
          model = Restaurant;
          key = 'restaurants';
          break;
        case 'eventcenter':
          model = EventCenter;
          key = 'eventcenters';
          break;
        case 'tourguide':
          model = TourGuide;
          key = 'tourguides';
          break;
        case 'chop':
          model = Chop;
          key = 'chops';
          break;
        case 'gift':
          model = Gift;
          key = 'gifts';
          break;
        default:
          continue;
      }

      let item;
      if (type === 'menu') {
        item = await model.findById(itemId).populate('restaurantId', 'name city state');
        if (!item) continue;
      } else if (type === 'room') {
        item = await model.findById(itemId).populate('hotelId', 'name city state');
        if (!item) continue;
        item.city = item.hotelId?.city || '';
        item.state = item.hotelId?.state || '';
      } else {
        item = await model.findById(itemId);
        if (!item) continue;
      }

      response[key].push(item);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('[feature-listing/public] error:', err);
    res.status(500).json({ message: 'Failed to fetch featured listings', error: err.message });
  }
});

module.exports = router;

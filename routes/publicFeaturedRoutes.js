const express = require('express');
const router = express.Router();
const FeatureListing = require('../models/featureListingModel');
const auth = require('../middleware/Auth');
const axios = require('axios');

// ✅ MODELS
const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');
const TourGuide = require('../models/tourGuideModel');
const Chop = require('../models/chopModel');
const Gift = require('../models/giftModel');

// ✅ Create unpaid feature listing
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Access denied: vendors only' });
    }

    const { roomId, featureType, resourceType } = req.body;

    const newFeature = new FeatureListing({
      vendorId: req.user._id,
      featureType,
      resourceType,
      resourceId: roomId,
      isPaid: false,
    });

    await newFeature.save();
    res.status(201).json({ message: 'Feature request submitted', feature: newFeature });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create feature request', error: err.message });
  }
});

// ✅ Convert duration string to days
const getFeatureDuration = (duration) => ({
  '7d': 7,
  '1m': 30,
  '6m': 180,
  '1y': 365,
}[duration] || 7);

// ✅ Normalize resource type
const normalizeResourceType = (pathLabel) => {
  const map = {
    shortlets: 'shortlet',
    restaurants: 'restaurant',
    eventcenters: 'eventcenter',
    tourguides: 'tourguide',
    chops: 'chop',
    gifts: 'gift',
    menus: 'menu',
    room: 'room',
  };
  return map[pathLabel] || 'room';
};

// ✅ Unified handler for saving paid feature
const handleFeatureListing = async (resourceId, vendorId, featureType, durationDays, res, resourceType = 'room') => {
  const now = new Date();

  try {
    const query = {
      vendorId,
      featureType,
      resourceType,
      isPaid: false,
    };

    let feature = await FeatureListing.findOne(query);

    if (!feature) {
      feature = new FeatureListing({
        vendorId,
        featureType,
        resourceType,
        resourceId,
      });
    }

    // ✅ Always ensure resourceId and resourceType are updated
    feature.resourceId = resourceId;
    feature.resourceType = resourceType;
    feature.isPaid = true;
    feature.featuredFrom = now;
    feature.featuredTo = new Date(now.getTime() + durationDays * 86400000);

    await feature.save();
    return res.status(200).json(feature);
  } catch (err) {
    return res.status(500).json({ message: 'Internal server error in feature listing', error: err.message });
  }
};

// ✅ Add Paystack route
const addPaystackRoute = (pathLabel) => {
  router.post(`/paystack/${pathLabel}/verify/:reference`, auth, async (req, res) => {
    const { reference } = req.params;
    const { roomId, featureType, duration } = req.body;

    try {
      const verifyRes = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      });

      const data = verifyRes.data;

      if (data.status && data.data.status === 'success') {
        const durationDays = getFeatureDuration(duration);
        const resourceType = normalizeResourceType(pathLabel);
        await handleFeatureListing(roomId, req.user._id, featureType, durationDays, res, resourceType);
      } else {
        return res.status(400).json({ message: 'Transaction verification failed' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Server error during Paystack verification' });
    }
  });
};

// ✅ Add Flutterwave route
const addFlutterwaveRoute = (pathLabel) => {
  router.post(`/flutterwave/${pathLabel}/verify/:transactionId`, auth, async (req, res) => {
    const { transactionId } = req.params;
    const { roomId, featureType, duration } = req.body;

    try {
      const verifyRes = await axios.get(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          headers: {
            Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          },
        }
      );

      const data = verifyRes.data;

      if (data.status === 'success') {
        const durationDays = getFeatureDuration(duration);
        const resourceType = normalizeResourceType(pathLabel);
        await handleFeatureListing(roomId, req.user._id, featureType, durationDays, res, resourceType);
      } else {
        return res.status(400).json({ message: 'Transaction verification failed' });
      }
    } catch (err) {
      res.status(500).json({ message: 'Server error during Flutterwave verification' });
    }
  });
};

// ✅ Register routes for each service type
[
  'shortlets',
  'restaurants',
  'eventcenters',
  'tourguides',
  'chops',
  'gifts',
  'menus',
].forEach((type) => {
  addPaystackRoute(type);
  addFlutterwaveRoute(type);
});

// ✅ Add legacy support for 'room'
addPaystackRoute('room');
addFlutterwaveRoute('room');

// ✅ PUBLIC ROUTE for fetching featured listings
router.get('/public', async (req, res) => {
  try {
    const now = new Date();
    const { state } = req.query;

    const listings = await FeatureListing.find({
      isPaid: true,
      featuredFrom: { $lte: now },
      featuredTo: { $gte: now },
    });

    const response = {
      hotels: [],
      shortlets: [],
      restaurants: [],
      eventcenters: [],
      tourguides: [],
      chops: [],
      gifts: [],
    };

    for (const feature of listings) {
      const type = feature.resourceType || 'room';
      const itemId = feature.resourceId || feature.roomId;

      console.log(`🟡 Processing feature _id: ${feature._id}, resourceType: ${type}, resourceId: ${itemId}`);

      if (!itemId) {
        console.warn(`⚠️ Missing resourceId and roomId for feature with _id: ${feature._id}`);
        continue;
      }

      let model = null;
      let key = null;

      switch (type) {
        case 'room':
          model = Hotel;
          key = 'hotels';
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

      const item = await model.findById(itemId);
      if (!item) {
        console.warn(`⚠️ No item found in ${type} for ID: ${itemId}`);
        continue;
      }

      if (feature.featureType === 'local' && state && item.state?.toLowerCase() !== state.toLowerCase()) {
        continue;
      }

      response[key].push(item);
    }

    res.status(200).json(response);
  } catch (err) {
    console.error('❌ Failed to fetch public featured listings:', err);
    res.status(500).json({ message: 'Failed to fetch featured listings', error: err.message });
  }
});

module.exports = router;

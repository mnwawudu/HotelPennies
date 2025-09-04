const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');

const FeatureListing = require('../models/featureListingModel');

// Polymorphic resources (for row enrichment)
const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');
const TourGuide = require('../models/tourGuideModel');
const Chop = require('../models/chopModel');
const Gift = require('../models/giftModel');
const Room = require('../models/roomModel');
const RestaurantMenu = require('../models/restaurantMenuModel');
const Vendor = require('../models/vendorModel');

// --------- helpers ----------
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
const now = () => new Date();

const ACTIVE_MATCH = () => ({
  isPaid: true,
  featuredFrom: { $lte: now() },
  featuredTo: { $gte: now() },
  $or: [{ disabled: { $exists: false } }, { disabled: { $ne: true } }],
});

const statusOf = (doc) => {
  const t = new Date();
  if (doc.disabled) return 'expired';
  if (doc.featuredFrom && doc.featuredFrom > t) return 'scheduled';
  if (doc.featuredTo && doc.featuredTo < t) return 'expired';
  return 'active';
};

function days(n = 0) {
  return n * 86400000;
}

function pickThumb(x) {
  // Best-effort image selection across your models
  return x?.imageCover || x?.images?.[0] || x?.photos?.[0] || x?.photo || x?.image || null;
}

function pickName(x) {
  return x?.name || x?.title || x?.roomName || x?.businessName || null;
}

function pickLocation(x) {
  const city = x?.city || x?.hotelId?.city || x?.restaurantId?.city || '';
  const state = x?.state || x?.hotelId?.state || x?.restaurantId?.state || '';
  const addr = x?.address || '';
  const c = [addr, city, state].filter(Boolean).join(', ');
  return c || null;
}

async function fetchResource(resourceType, id) {
  if (!isObjectId(id)) return null;
  switch (resourceType) {
    case 'shortlet':
      return Shortlet.findById(id).lean();
    case 'restaurant':
      return Restaurant.findById(id).lean();
    case 'eventcenter':
      return EventCenter.findById(id).lean();
    case 'tourguide':
      return TourGuide.findById(id).lean();
    case 'chop':
      return Chop.findById(id).lean();
    case 'gift':
      return Gift.findById(id).lean();
    case 'menu':
      return RestaurantMenu.findById(id).populate('restaurantId', 'name city state').lean();
    case 'room':
      return Room.findById(id).populate('hotelId', 'name city state').lean();
    default:
      return null;
  }
}

// Optionally keep model flags in sync when forcibly unfeaturing
async function setModelFeatured(resourceType, id, featured) {
  const update = { featured: !!featured, isFeatured: !!featured };
  switch (resourceType) {
    case 'shortlet':
      return Shortlet.findByIdAndUpdate(id, update).lean();
    case 'restaurant':
      return Restaurant.findByIdAndUpdate(id, update).lean();
    case 'eventcenter':
      return EventCenter.findByIdAndUpdate(id, update).lean();
    // room/menu typically don't carry site-wide "featured", ignore
    default:
      return null;
  }
}

// --------- OVERVIEW: counts by resourceType (active only) ----------
router.get('/overview', adminAuth, async (req, res) => {
  try {
    const rows = await FeatureListing.aggregate([
      { $match: ACTIVE_MATCH() },
      { $group: { _id: '$resourceType', count: { $sum: 1 } } },
    ]);

    const breakdown = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

    res.json({ total, breakdown });
  } catch (err) {
    console.error('features overview error:', err);
    res.status(500).json({ message: 'Failed to load overview' });
  }
});

// --------- LIST: paginated table for admin ----------
router.get('/list', adminAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const type = String(req.query.resourceType || 'all').toLowerCase();
    const status = String(req.query.status || 'active').toLowerCase(); // active|scheduled|expired|all
    // const q = (req.query.q || '').trim().toLowerCase(); // (reserved)

    const m = {};
    if (type !== 'all') m.resourceType = type;

    if (status !== 'all') {
      const t = now();
      if (status === 'active') {
        Object.assign(m, ACTIVE_MATCH());
      } else if (status === 'scheduled') {
        Object.assign(m, {
          isPaid: true,
          featuredFrom: { $gt: t },
          $or: [{ disabled: { $exists: false } }, { disabled: { $ne: true } }],
        });
      } else if (status === 'expired') {
        Object.assign(m, {
          $or: [{ featuredTo: { $lt: t } }, { disabled: true }],
        });
      }
    }

    const docs = await FeatureListing.find(m)
      .sort({ featuredTo: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Enrich: vendor + polymorphic resource
    const vendorIds = [...new Set(docs.map((d) => String(d.vendorId)).filter(isObjectId))];
    const vendors = await Vendor.find({ _id: { $in: vendorIds } })
      .select('name email businessName')
      .lean();
    const vendorMap = Object.fromEntries(vendors.map((v) => [String(v._id), v]));

    const rows = [];
    for (const d of docs) {
      const resDoc = await fetchResource(d.resourceType, d.resourceId);
      const v = vendorMap[String(d.vendorId)] || null;

      rows.push({
        _id: String(d._id),
        resourceType: d.resourceType,
        resourceId: String(d.resourceId || ''),
        featureType: d.featureType, // local | global
        scopeState: d.state || null, // target state for local scope
        featuredFrom: d.featuredFrom,
        featuredTo: d.featuredTo,
        isPaid: !!d.isPaid,
        status: statusOf(d),

        vendorName: v?.businessName || v?.name || null,
        vendorEmail: v?.email || null,

        itemName: pickName(resDoc),
        itemLocation: pickLocation(resDoc),
        thumb: pickThumb(resDoc),
      });
    }

    const total = await FeatureListing.countDocuments(m);
    res.json({ rows, page, limit, total });
  } catch (err) {
    console.error('features list error:', err);
    res.status(500).json({ message: 'Failed to load feature list' });
  }
});

// --------- CREATE: admin creates a feature manually ----------
router.post('/', adminAuth, async (req, res) => {
  try {
    const resourceType = String(req.body.resourceType || '').toLowerCase();
    const resourceId = req.body.resourceId;
    const vendorId = req.body.vendorId;
    const featureType = String(req.body.featureType || 'local').toLowerCase();
    const state = String(req.body.state || '').trim();
    const durationDays = Number(req.body.durationDays || 7);

    if (!resourceType || !resourceId || !vendorId) {
      return res
        .status(400)
        .json({ message: 'resourceType, resourceId and vendorId are required' });
    }
    if (!isObjectId(resourceId) || !isObjectId(vendorId)) {
      return res.status(400).json({ message: 'Invalid resourceId or vendorId' });
    }
    if (featureType === 'local' && !state) {
      return res.status(400).json({ message: 'state is required for local features' });
    }

    const start = now();
    const end = new Date(start.getTime() + days(durationDays));

    const doc = await FeatureListing.create({
      vendorId,
      featureType, // 'global' | 'local'
      resourceType,
      resourceId,
      isPaid: true,
      featuredFrom: start,
      featuredTo: end,
      state: featureType === 'local' ? state : undefined,
      disabled: false,
      meta: { createdByAdmin: true },
    });

    // Optional: set model featured flag for explore curation (non-blocking)
    try {
      await setModelFeatured(resourceType, resourceId, true);
    } catch {}

    res.status(201).json(doc);
  } catch (err) {
    console.error('create feature error:', err);
    res.status(500).json({ message: 'Failed to create feature' });
  }
});

// --------- UNFEATURE NOW: end early ----------
router.post('/:id/unfeature', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

    const doc = await FeatureListing.findById(id);
    if (!doc) return res.status(404).json({ message: 'Feature not found' });

    doc.featuredTo = new Date(Date.now() - 1000);
    doc.disabled = true;
    await doc.save();

    try {
      await setModelFeatured(doc.resourceType, doc.resourceId, false);
    } catch {}

    res.json({ ok: true });
  } catch (err) {
    console.error('unfeature error:', err);
    res.status(500).json({ message: 'Failed to unfeature' });
  }
});

// --------- EXTEND by N days ----------
router.patch('/:id/extend', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const addDays = Number(req.body?.days || 7);
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

    const doc = await FeatureListing.findById(id);
    if (!doc) return res.status(404).json({ message: 'Feature not found' });

    const base = doc.featuredTo && doc.featuredTo > now() ? doc.featuredTo : now();
    doc.featuredFrom = doc.featuredFrom || now();
    doc.featuredTo = new Date(base.getTime() + days(addDays));
    doc.disabled = false;
    await doc.save();

    try {
      await setModelFeatured(doc.resourceType, doc.resourceId, true);
    } catch {}

    res.json({ ok: true });
  } catch (err) {
    console.error('extend error:', err);
    res.status(500).json({ message: 'Failed to extend feature' });
  }
});

// --------- DELETE record ----------
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) return res.status(400).json({ message: 'Invalid id' });

    const doc = await FeatureListing.findByIdAndDelete(id);
    if (doc) {
      try {
        await setModelFeatured(doc.resourceType, doc.resourceId, false);
      } catch {}
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('delete feature error:', err);
    res.status(500).json({ message: 'Failed to delete feature' });
  }
});

module.exports = router;

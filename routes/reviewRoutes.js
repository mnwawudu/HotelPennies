// routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');

// Existing models
const Shortlet = require('../models/shortletModel');
const Hotel = require('../models/hotelModel');
const HotelRoom = require('../models/hotelRoomModel');

// 🔻 Add your other listing models (adjust paths/names if different)
const Restaurant   = require('../models/restaurantModel');     // e.g. Restaurant
const Gift         = require('../models/giftModel');           // e.g. Gift
const EventCenter  = require('../models/eventCenterModel');    // e.g. EventCenter
const TourGuide    = require('../models/tourGuideModel');      // e.g. TourGuide
const CityCruise   = require('../models/cruiseModel');         // e.g. CityCruise
const Chop         = require('../models/chopModel');           // e.g. Chop

// --- Type normalization (accept singular/plural & dashed forms) ---
const TYPE_ALIASES = {
  hotels: 'hotel',
  shortlets: 'shortlet',
  rooms: 'room',

  restaurants: 'restaurant',
  gifts: 'gift',
  chops: 'chop',

  'tour-guides': 'tourguide',
  tourguides: 'tourguide',
  'tour-guide': 'tourguide',

  eventcenters: 'eventcenter',
  'event-centers': 'eventcenter',
  'event-center': 'eventcenter',

  cruises: 'citycruise',
  'city-cruise': 'citycruise',
  'city-cruises': 'citycruise',
};

const normalizeType = (t) => {
  const k = String(t || '').toLowerCase().trim();
  return TYPE_ALIASES[k] || k;
};

// Map normalized type → Model
const MODEL_BY_TYPE = {
  hotel: Hotel,
  shortlet: Shortlet,
  room: HotelRoom,

  restaurant: Restaurant,
  gift: Gift,
  eventcenter: EventCenter,
  tourguide: TourGuide,
  citycruise: CityCruise,
  chop: Chop,
};

const ALLOWED_TYPES = Object.keys(MODEL_BY_TYPE);

// ✅ Helper: Add review and update average rating WITHOUT triggering full doc validation
const handleReview = async (Model, itemId, { user, userName, rating, comment }) => {
  // Load only what we need (avoid validating unrelated required fields on save)
  const item = await Model.findById(itemId).select('reviews averageRating');
  if (!item) throw new Error('Item not found');

  const userId = String(user);
  const reviews = Array.isArray(item.reviews) ? item.reviews : [];

  // Prevent duplicate reviews by same user
  const alreadyReviewed = reviews.find((r) => String(r.user) === userId);
  if (alreadyReviewed) throw new Error('You already submitted a review');

  // Validate rating
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error('Rating must be a number between 1 and 5');
  }

  const review = {
    user: new mongoose.Types.ObjectId(userId),
    userName,
    rating: numericRating,
    comment: String(comment || '').trim(),
    createdAt: new Date(),
  };

  // Incremental average to avoid summing the full array twice
  const count = reviews.length;
  const prevAvg = Number(item.averageRating || 0);
  const newAvg = count === 0 ? numericRating : ((prevAvg * count) + numericRating) / (count + 1);

  // Atomic update; skip validators on unrelated required fields (e.g., city on Chop)
  await Model.updateOne(
    { _id: itemId },
    { $push: { reviews: review }, $set: { averageRating: newAvg } },
    { runValidators: false }
  );

  // Return fresh reviews to preserve your existing response shape
  const fresh = await Model.findById(itemId).select('reviews');
  return fresh;
};

// 📌 POST /api/reviews/:type/:id
router.post('/:type/:id', auth, async (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    const { id } = req.params;
    const { rating, comment } = req.body;
    const { _id: user, name: userName } = req.user || {};

    const Model = MODEL_BY_TYPE[type];
    if (!Model) {
      return res.status(400).json({
        message: 'Invalid review type',
        allowedTypes: ALLOWED_TYPES,
      });
    }

    const updatedItem = await handleReview(Model, id, { user, userName, rating, comment });

    // Preserve your existing shape: { message, data: updatedItem.reviews }
    res.status(201).json({
      message: 'Review submitted successfully',
      data: updatedItem.reviews,
    });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Bad Request' });
  }
});

// 📌 GET /api/reviews/:type/:id
router.get('/:type/:id', async (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    const { id } = req.params;

    const Model = MODEL_BY_TYPE[type];
    if (!Model) {
      return res.status(400).json({
        message: 'Invalid review type',
        allowedTypes: ALLOWED_TYPES,
      });
    }

    const item = await Model.findById(id).select('reviews');
    if (!item) return res.status(404).json({ message: 'Item not found' });

    // Preserve your existing shape: just the array
    res.json(item.reviews || []);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

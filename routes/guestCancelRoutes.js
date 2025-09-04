// routes/guestCancelRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const HotelBooking        = require('../models/hotelBookingModel');
const ShortletBooking     = require('../models/shortletBookingModel');
const RestaurantBooking   = require('../models/restaurantBookingModel');
const EventCenterBooking  = require('../models/eventCenterBookingModel');
const TourGuideBooking    = require('../models/tourGuideBookingModel');
const ChopsBooking        = require('../models/chopsBookingModel');
const GiftBooking         = require('../models/giftBookingModel');

const { reverseBookingEarnings } = require('../utils/reverseBookingEarnings');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';

/** try to enrich missing email via Paystack verify */
async function fetchEmailFromPaystack(reference) {
  if (!PAYSTACK_SECRET_KEY || !reference) return null;
  try {
    const resp = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const data = resp?.data?.data;
    const email = data?.customer?.email || data?.authorization?.account_name || null;
    return email ? String(email).toLowerCase() : null;
  } catch {
    return null;
  }
}

/** build a flexible query for reference + optional email (covers varied schemas) */
function buildFindQuery(reference, emailLower) {
  const refOrs = [
    { paymentReference: reference },
    { reference: reference },
    { paymentRef: reference },
    { 'meta.paymentReference': reference },
  ];

  // email fields across schemas
  const emailOrs = emailLower
    ? [
        { email: emailLower },
        { buyerEmail: emailLower },
        { customerEmail: emailLower },
        { contactEmail: emailLower },
        { 'customer.email': emailLower },
      ]
    : [];

  if (emailOrs.length) {
    return { $and: [{ $or: refOrs }, { $or: emailOrs }] };
  }
  return { $or: refOrs };
}

/** best-effort cancel flag across different schemas */
async function markCancelled(doc) {
  try {
    // common flags
    if ('canceled' in doc) doc.canceled = true;
    // some schemas use status/bookingStatus
    if ('status' in doc) doc.status = 'cancelled';
    if ('bookingStatus' in doc) doc.bookingStatus = 'cancelled';
    // some track a date
    if ('canceledAt' in doc) doc.canceledAt = new Date();

    // allow setting even if field doesn't exist in schema (strict: false)
    doc.set('canceled', true, { strict: false });
    doc.set('canceledAt', new Date(), { strict: false });
    doc.set('status', 'cancelled', { strict: false });

    await doc.save();
    return true;
  } catch {
    return false;
  }
}

/** category mapper for reverseBookingEarnings meta (does not change ledger logic) */
function categoryForModel(modelName) {
  switch (modelName) {
    case 'HotelBooking':
    case 'ShortletBooking':
      return 'hotel'; // treat shortlet as lodging for cashback/ref
    case 'RestaurantBooking':
      return 'restaurant';
    case 'EventCenterBooking':
      return 'event';
    case 'TourGuideBooking':
      return 'tour';
    case 'ChopsBooking':
    case 'GiftBooking':
      return 'chops'; // gifts/chops have no cashback in your setup
    default:
      return 'hotel';
  }
}

const SEARCH_SPAN = [
  { model: HotelBooking,       name: 'HotelBooking' },
  { model: ShortletBooking,    name: 'ShortletBooking' },
  { model: RestaurantBooking,  name: 'RestaurantBooking' },
  { model: EventCenterBooking, name: 'EventCenterBooking' },
  { model: TourGuideBooking,   name: 'TourGuideBooking' },
  { model: ChopsBooking,       name: 'ChopsBooking' },
  { model: GiftBooking,        name: 'GiftBooking' },
];

/**
 * POST /api/bookings/guest/cancel-token
 * Body: { reference: string, email?: string }
 * Falls back to Paystack to infer email if not provided.
 */
router.post('/cancel-token', async (req, res) => {
  try {
    const reference = String(req.body?.reference || req.query?.reference || '').trim();
    let emailLower  = (req.body?.email || req.query?.email || '').toLowerCase().trim();

    if (!reference) {
      return res.status(400).json({ message: 'reference is required' });
    }

    // If no email, try Paystack to get the customer email tied to the reference
    if (!emailLower) {
      emailLower = await fetchEmailFromPaystack(reference);
    }

    // Try each collection until we find a match
    let found = null;
    let modelUsed = null;

    for (const entry of SEARCH_SPAN) {
      const q = buildFindQuery(reference, emailLower);
      const doc = await entry.model.findOne(q).exec();
      if (doc) {
        found = doc;
        modelUsed = entry.name;
        break;
      }
    }

    if (!found) {
      return res.status(404).json({ message: 'No matching booking found for the provided reference/email' });
    }

    // If already cancelled, reply idempotently
    const already =
      found.canceled === true ||
      String(found.status || '').toLowerCase().includes('cancel') ||
      String(found.bookingStatus || '').toLowerCase().includes('cancel');

    if (!already) {
      await markCancelled(found);

      // Reverse user earnings if applicable (lodging uses cashback/referral)
      const cat = categoryForModel(modelUsed);
      await reverseBookingEarnings({ booking: found, category: cat }).catch(() => {});
      // NOTE: If you also want to reverse vendor/platform ledger here,
      // call your vendor/platform reversal function too (if you have one).
    }

    return res.json({
      ok: true,
      message: already ? 'Booking was already cancelled' : 'Booking cancelled successfully',
      bookingId: String(found._id),
      category: categoryForModel(modelUsed),
    });
  } catch (err) {
    console.error('❌ guest/cancel-token error:', err?.response?.data || err.message || err);
    return res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

module.exports = router;

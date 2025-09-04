// 📁 routes/tourGuideBookingRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');

const TourGuide = require('../models/tourGuideModel');
const TourGuideBooking = require('../models/tourGuideBookingModel');
const Vendor = require('../models/vendorModel'); // ✅ For vendor payouts

// ✅ Ledger (additive)
const {
  recordBookingLedger,
  releasePendingForBooking,
} = require('../services/ledgerService');

// 📧 Booking confirmation email
const sendBookingEmails = require('../utils/sendBookingEmails');

// ───────────────────────────────── helpers ───────────────────────────────────
const verifyPaystack = async (reference) => {
  try {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    return response.data?.status && response.data?.data?.status === 'success';
  } catch (e) {
    console.warn('⚠️ [tourguide/verified] Paystack verify failed:', e?.message || e);
    return false;
  }
};

const verifyFlutterwave = async (referenceOrTxId) => {
  try {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    // Using "verify_by_reference" makes more sense with our FE (we pass Paystack-like ref)
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?reference=${referenceOrTxId}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );
    return response.data?.data?.status === 'successful';
  } catch (e) {
    console.warn('⚠️ [tourguide/verified] Flutterwave verify failed:', e?.message || e);
    return false;
  }
};

const sameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

// ─────────────────────────────── routes ──────────────────────────────────────

// ✅ Create booking after verifying payment
//    Accept BOTH paths so FE/BE remain compatible.
router.post(['/tour-guide-bookings/verified', '/verified'], async (req, res) => {
  try {
    const {
      guideId,
      fullName,
      phone,
      email,
      tourDate,
      numberOfGuests,
      notes,
      paymentReference,
      paymentProvider,
      totalPrice
    } = req.body;

    console.log('➡️ [tourguide/verified] hit', req.originalUrl);
    console.log('⬅️ [tourguide/verified] keys:', Object.keys(req.body || {}));

    // 1️⃣ Find tour guide
    const guide = await TourGuide.findById(guideId);
    if (!guide) {
      console.error('❌ [tourguide/verified] guide not found:', guideId);
      return res.status(404).json({ error: 'Tour guide not found' });
    }

    // 2️⃣ Check if date is unavailable
    const isUnavailable = (guide.unavailableDates || []).some((d) => sameDay(d, tourDate));
    if (isUnavailable) {
      console.warn('⛔ [tourguide/verified] date unavailable:', tourDate);
      return res.status(400).json({ error: 'Selected tour date is unavailable' });
    }

    // 3️⃣ Verify payment
    let verified = false;
    const provider = String(paymentProvider || '').toLowerCase();
    if (provider === 'paystack') verified = await verifyPaystack(paymentReference);
    else if (provider === 'flutterwave') verified = await verifyFlutterwave(paymentReference);
    else return res.status(400).json({ error: 'Unsupported payment provider' });

    if (!verified) {
      console.warn('⛔ [tourguide/verified] payment not verified for ref:', paymentReference);
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // 4️⃣ Save booking — include vendorId for vendor dashboards
    if (!guide.vendorId) {
      // If your Booking schema requires vendorId, fail early with a good message
      console.error('❌ [tourguide/verified] guide.vendorId missing for guide:', String(guide._id));
      return res
        .status(400)
        .json({ error: 'Vendor configuration missing for this tour guide. Please contact support.' });
    }

    const booking = new TourGuideBooking({
      guideId,
      vendorId: guide.vendorId,      // 👈 critical for vendor views & schema that requires it
      fullName,
      phone,
      email,
      tourDate,
      numberOfGuests,
      notes, // keep once
      paymentReference,
      paymentProvider,
      paymentStatus: 'paid',
      totalPrice
    });

    // ❌ was auto-updating availability here
    // guide.unavailableDates = guide.unavailableDates || [];
    // guide.unavailableDates.push(new Date(tourDate));
    // await guide.save();
    // ✅ FIX: do not auto-mark unavailable; vendor controls calendar.

    await booking.save();
    console.log('✅ [tourguide/verified] Booking saved with ID:', String(booking._id));

    // 📧 Send booking confirmation email
    try {
      let vendorEmail = null;
      try {
        if (guide.vendorId) {
          const v = await Vendor.findById(guide.vendorId).select('email').lean();
          vendorEmail = v?.email || null;
        }
      } catch { /* ignore vendor lookup errors for email */ }

      await sendBookingEmails({
        // ✅ FIX: pass both "to" and "userEmail" for compatibility with either helper signature
        to: email,                     // some versions expect this
        userEmail: email,              // others expect this
        // and both "bcc" and "vendorEmail"
        bcc: vendorEmail || undefined, // if your helper supports bcc
        vendorEmail: vendorEmail || undefined,

        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL, // optional BCC if set
        category: 'Tour Guide',
        title: guide.name || guide.title || 'Tour Guide',
        subTitle: undefined,
        fullName,
        phone,
        guests: numberOfGuests,
        amount: totalPrice,
        paymentReference,
        tourDate, // itinerary date
        notes,    // include note in email
      });
    } catch (e) {
      console.warn('⚠️ sendBookingEmails(tour):', e?.message || e);
    }

    // 5️⃣ Vendor payout (85%) — PENDING snapshot (legacy compatibility)
    try {
      const vendorId = guide.vendorId;
      const vendor = vendorId ? await Vendor.findById(vendorId).exec() : null;
      if (vendor) {
        const vendorShare = Math.round(Number(totalPrice) * 0.85);
        vendor.payoutHistory = vendor.payoutHistory || [];
        vendor.payoutHistory.push({
          amount: vendorShare,
          account: {},
          status: 'pending',
          date: new Date(),
        });
        await vendor.save();
        console.log(`🏦 [tourguide/verified] Vendor credited (pending) ${vendor.email} +${vendorShare}`);
      } else {
        console.warn('⚠️ [tourguide/verified] Vendor not found for vendorId:', String(vendorId));
      }
    } catch (payoutErr) {
      console.warn('⚠️ [tourguide/verified] Vendor payout failed:', payoutErr?.message || payoutErr);
    }

    // 6️⃣ Ledger write (85/15; NO cashback/referral for tour guides)
    try {
      await recordBookingLedger({
        _id: booking._id,
        vendorId: guide.vendorId,
        userId: null, // no cashback/referral on tour guides
        totalCost: Number(totalPrice),
        checkInDate: tourDate ? new Date(tourDate) : null,
        checkOutDate: tourDate ? new Date(tourDate) : null,
        cashbackEligible: false,
        referralUserId: null,
        type: 'tour_guide', // normalized category for reporting
      });
      console.log('🧾 [tourguide/verified] Ledger rows recorded for booking:', String(booking._id));
    } catch (e) {
      // don’t fail booking if ledger write fails
      console.error('⚠️ [tourguide/verified] recordBookingLedger failed (booking continues):', e.message);
    }

    return res.status(201).json({ message: 'Booking successful', booking });
  } catch (err) {
    console.error('❌ [tourguide/verified] Booking verification error:', err);
    return res.status(500).json({ error: 'Booking failed after verification' });
  }
});

// ✅ Get all bookings (admin/debug)
router.get('/', async (req, res) => {
  try {
    const bookings = await TourGuideBooking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('❌ [tourguide] Fetch bookings failed:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ✅ Fetch unavailable dates for a tour guide
router.get('/:id/unavailable-dates', async (req, res) => {
  try {
    const guide = await TourGuide.findById(req.params.id);
    if (!guide) return res.status(404).json({ error: 'Tour guide not found' });

    res.json({ unavailableDates: guide.unavailableDates || [] });
  } catch (err) {
    console.error('❌ [tourguide] Failed to fetch unavailable dates:', err);
    res.status(500).json({ error: 'Error fetching unavailable dates' });
  }
});

/* ---------- Optional lifecycle endpoints: flip ledger pending → available ---------- */

// Mark check-in (soft; useful if you want to track service phase)
router.post('/:id/check-in', async (req, res) => {
  const b = await TourGuideBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_in';
    b.checkInDate = b.checkInDate || new Date();
    await b.save();
  } catch (_) { /* ignore if schema is strict */ }

  res.json({ ok: true });
});

// Mark check-out and release pending → available (calls ledger sweep)
router.post('/:id/check-out', async (req, res) => {
  const b = await TourGuideBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_out';
    b.checkOutDate = b.checkOutDate || new Date();
    await b.save();
  } catch (_) { /* ignore if schema is strict */ }

  const released = await releasePendingForBooking(b._id);
  res.json({ ok: true, released });
});

module.exports = router;

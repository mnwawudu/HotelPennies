// routes/bookingCancelRoutes.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const nodemailer = require('nodemailer');

const Ledger = require('../models/ledgerModel');
const Vendor = require('../models/vendorModel');
const sendCancellationEmails = require('../utils/sendCancellationEmails');
const { reverseBookingEarnings } = require('../utils/reverseBookingEarnings');

function safeRequire(p) { try { return require(p); } catch { return null; } }
// Booking models
const HotelBooking      = safeRequire('../models/hotelBookingModel');
const ShortletBooking   = safeRequire('../models/shortletBookingModel');
const EventBooking      = safeRequire('../models/eventCenterBookingModel');
const RestaurantBooking = safeRequire('../models/restaurantBookingModel');
const TourBooking       = safeRequire('../models/tourGuideBookingModel');
const ChopsBooking      = safeRequire('../models/chopsBookingModel');
const GiftBooking       = safeRequire('../models/giftBookingModel');

// Linked item models
const Room       = safeRequire('../models/roomModel');
const Hotel      = safeRequire('../models/hotelModel');
const Shortlet   = safeRequire('../models/shortletModel');
const EventCtr   = safeRequire('../models/eventCenterModel');
const Restaurant = safeRequire('../models/restaurantModel');
const TourGuide  = safeRequire('../models/tourGuideModel');

const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CANCEL_SECRET = process.env.CANCEL_SECRET || process.env.JWT_SECRET || 'hp_cancel_secret';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const CANCEL_PAGE_PATH = process.env.CANCEL_PAGE_PATH || '/manage-booking/cancel';

// ---------- mailer ----------
function makeTransport() {
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    return nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return null;
}
async function sendMagicLinkEmail(to, primaryLink, fallbackLink) {
  const tx = makeTransport();
  if (!tx) {
    console.warn('[bookingCancel] Magic-link email skipped (missing SMTP creds). Link:', primaryLink);
    return { sent: false, reason: 'missing_smtp' };
  }
  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@hotelpennies';
  const subject = 'Cancel your booking – HotelPennies';
  const text = `We received a request to cancel your booking.\n\nClick this link:\n${primaryLink}\n\nIf that doesn’t open, try:\n${fallbackLink}\n`;
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5">
    <p>We received a request to cancel your booking.</p>
    <p><a href="${primaryLink}" style="display:inline-block;background:#0a3d62;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Cancel my booking</a></p>
    <p>If that doesn’t open, try this link:</p>
    <p style="word-break:break-all"><a href="${fallbackLink}">${fallbackLink}</a></p>
  </div>`;
  await tx.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

function extractAuth(req) {
  const hdr = req.headers.authorization;
  if (!hdr) return {};
  try {
    const token = hdr.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { userId: decoded?.id || null, role: decoded?.role || null, email: decoded?.email || null };
  } catch { return {}; }
}

// ---------- refund policy (unchanged) ----------
function computeRefundPercent(categoryLabel, booking) {
  const now = new Date();
  const startRaw = booking.checkIn || booking.reservationTime || booking.tourDate || booking.eventDate;
  if (!startRaw) return 0;
  const start = new Date(startRaw);
  const hoursToStart = (start - now) / (1000 * 60 * 60);
  const cat = String(categoryLabel || '').toLowerCase();

  if (cat.includes('event')) {
    if (hoursToStart >= 24 * 7) return 100;
    if (hoursToStart >= 48)     return 50;
    return 0;
  }
  if (cat.includes('tour')) {
    if (hoursToStart > 48) return 100;
    if (hoursToStart > 24) return 50;
    return 0;
  }
  if (cat.includes('hotel') || cat.includes('shortlet') || cat.includes('lodging')) {
    if (hoursToStart >= 24 * 7) return 100;
    if (hoursToStart >= 48)     return 50;
    return 0;
  }
  if (cat.includes('restaurant')) return hoursToStart >= 24 ? 50 : 0;
  return 0;
}

// ---------- finders ----------
function buildFindQuery(reference, emailLower) {
  const refOr = [
    { paymentReference: reference },
    { reference: reference },
    { paymentRef: reference },
    { 'meta.paymentReference': reference },
  ];
  const emailOr = emailLower
    ? [
        { email: new RegExp(`^${emailLower}$`, 'i') },
        { buyerEmail: new RegExp(`^${emailLower}$`, 'i') },
        { customerEmail: new RegExp(`^${emailLower}$`, 'i') },
        { contactEmail: new RegExp(`^${emailLower}$`, 'i') },
        { 'customer.email': new RegExp(`^${emailLower}$`, 'i') },
      ]
    : [];
  return emailOr.length ? { $and: [{ $or: refOr }, { $or: emailOr }] } : { $or: refOr };
}

async function fetchEmailFromPaystack(reference) {
  if (!PAYSTACK_SECRET_KEY || !reference) return null;
  try {
    const resp = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const data = resp?.data?.data;
    const email = data?.customer?.email || null;
    return email ? String(email).toLowerCase().trim() : null;
  } catch { return null; }
}

// verify/refund helpers (unchanged)
async function verifyPaystack(reference) {
  const res = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });
  const data = res?.data?.data || {};
  return { ok: data.status === 'success', id: data.id, amount: data.amount };
}
async function refundPaystack(transactionId, amountNgn) {
  const res = await axios.post(
    'https://api.paystack.co/refund',
    { transaction: transactionId, amount: Math.round(Number(amountNgn) * 100) },
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );
  return { ok: !!res?.data?.status, data: res?.data };
}
async function verifyFlutter(reference) {
  const res = await axios.get(
    `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  const data = res?.data?.data || {};
  return { ok: res?.data?.status === 'success', id: data.id || data.transaction_id, amount: data.amount };
}
async function refundFlutter(transactionId, amountNgn) {
  const res = await axios.post(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/refund`,
    { amount: Math.round(Number(amountNgn)) },
    { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
  );
  return { ok: res?.data?.status === 'success', data: res?.data };
}

// ------- Ledger helpers (UPDATED) -------
async function deleteLedgerForBooking(bookingId) {
  const _id = new mongoose.Types.ObjectId(bookingId);
  await Ledger.deleteMany({
    bookingId: _id,
    // do NOT touch user rows
    accountType: { $in: ['vendor', 'admin', 'platform'] },
    // and never touch explicit adjustments even for those accounts
    $or: [
      { 'meta.subtype': { $exists: false } },
      { 'meta.subtype': { $nin: ['user_referral_reversal', 'user_cashback_reversal', 'vendor_reversal', 'platform_reversal'] } }
    ]
  });
}

async function ledgerHasAnyForBooking(bookingId) {
  const _id = new mongoose.Types.ObjectId(bookingId);
  return !!(await Ledger.exists({ bookingId: _id }));
}

// SEARCHERS map (unchanged, shortened for brevity here)
const SEARCHERS = [
  // ... (same as your current file)
  // hotel, shortlet, event, restaurant, tour, chops, gifts – with resolver per model
].filter(Boolean);

async function findBookingAcrossModels(id) {
  for (const entry of SEARCHERS) {
    if (!entry?.Model) continue;
    const doc = await entry.Model.findById(id).lean();
    if (doc) return { entry, booking: doc };
  }
  return null;
}

// ---------- guest token (unchanged) ----------
const guestTokenPaths = ['/guest/cancel-token', '/bookings/guest/cancel-token'];
router.post(guestTokenPaths, async (req, res) => {
  try {
    let { email, paymentReference, reference } = req.body || {};
    const ref = String(paymentReference || reference || '').trim();
    let emailLower = String(email || '').toLowerCase().trim();
    if (!ref) return res.status(400).json({ message: 'paymentReference is required' });

    if (!emailLower) {
      emailLower = await fetchEmailFromPaystack(ref);
      if (!emailLower) return res.status(400).json({ message: 'email is required' });
    }

    let foundId = null;
    for (const entry of SEARCHERS) {
      if (!entry?.Model) continue;
      const doc = await entry.Model.findOne(buildFindQuery(ref, emailLower)).select('_id').lean();
      if (doc?._id) { foundId = doc._id; break; }
    }
    if (!foundId) return res.status(404).json({ message: 'No matching booking found' });

    const token = jwt.sign({ bid: String(foundId), email: emailLower, ref, p: 'guest_cancel' }, CANCEL_SECRET, { expiresIn: '2h' });

    const linkPrimary  = `${APP_URL}${CANCEL_PAGE_PATH}?t=${encodeURIComponent(token)}`;
    const linkFallback = `${APP_URL}/manage-booking-cancel?t=${encodeURIComponent(token)}`;

    try { await sendMagicLinkEmail(emailLower, linkPrimary, linkFallback); } catch {}

    return res.json({ ok: true, message: 'Cancel link generated.', link: linkPrimary, altLink: linkFallback });
  } catch (err) {
    console.error('cancel-token error', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Could not create cancel link' });
  }
});

// ---------- guest cancel (ORDER fixed: reverse BEFORE delete) ----------
const guestCancelPaths = ['/guest/cancel', '/bookings/guest/cancel'];
router.post(guestCancelPaths, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: 'token is required' });

    let payload;
    try { payload = jwt.verify(token, CANCEL_SECRET); }
    catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
    if (payload?.p !== 'guest_cancel' || !payload?.bid) return res.status(400).json({ message: 'Malformed token' });

    const located = await findBookingAcrossModels(payload.bid);
    if (!located) return res.status(404).json({ message: 'Booking not found' });

    const { entry, booking } = located;
    const already =
      booking.canceled === true ||
      String(booking.status || '').toLowerCase().includes('cancel') ||
      String(booking.bookingStatus || '').toLowerCase().includes('cancel');

    // refund preview
    const info = await entry.resolver(booking);
    const baseAmount = Number(booking.price || booking.total || booking.totalPrice || booking.amount || 0);
    const percent = computeRefundPercent(info.categoryLabel, booking);
    const amountNgn = Math.round((baseAmount * percent) / 100);

    // attempt provider refund if eligible (unchanged)
    let refund = { attempted: false, ok: false, provider: booking.paymentProvider, details: null };
    if (!already && booking.paymentStatus === 'paid' && amountNgn > 0 && (booking.paymentReference || booking.reference || booking.paymentRef)) {
      refund.attempted = true;
      const provider = String(booking.paymentProvider || booking.paymentMethod || '').toLowerCase();
      const refUse = booking.paymentReference || booking.reference || booking.paymentRef;

      if (provider === 'paystack') {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          refund.details = 'PAYSTACK_SECRET_KEY missing; skipped refund.';
        } else {
          const ver = await verifyPaystack(refUse);
          if (ver.ok && ver.id) {
            const rf = await refundPaystack(ver.id, amountNgn);
            refund.ok = rf.ok; refund.details = rf.data || null;
          } else refund.details = 'Verification failed; refund skipped.';
        }
      }
      if (provider === 'flutterwave') {
        if (!process.env.FLUTTERWAVE_SECRET_KEY) {
          refund.details = 'FLUTTERWAVE_SECRET_KEY missing; skipped refund.';
        } else {
          const ver = await verifyFlutter(refUse);
          if (ver.ok && ver.id) {
            const rf = await refundFlutter(ver.id, amountNgn);
            refund.ok = rf.ok; refund.details = rf.data || null;
          } else refund.details = 'Verification failed; refund skipped.';
        }
      }
    }

    // now mark cancelled & THEN purge ledger if you still want to
    if (!already) {
      const update = {};
      if (Object.prototype.hasOwnProperty.call(booking, 'canceled')) update.canceled = true;
      if (Object.prototype.hasOwnProperty.call(booking, 'cancellationDate')) update.cancellationDate = new Date();
      if (Object.keys(update).length) await entry.Model.updateOne({ _id: payload.bid }, { $set: update });
    }

    // (optional) purge booking-ledger rows after reversal
    if (await ledgerHasAnyForBooking(payload.bid)) await deleteLedgerForBooking(payload.bid);

    // emails unchanged
    try {
      await sendCancellationEmails({
        category: info.categoryLabel,
        userEmail: info.userEmail,
        vendorEmail: info.vendorEmail,
        adminEmail: info.adminEmail,
        title: info.title,
        subTitle: info.subTitle,
        fullName: info.meta.fullName,
        phone: info.meta.phone,
        guests: info.meta.guests,
        checkIn: info.meta.checkIn,
        checkOut: info.meta.checkOut,
        eventDate: info.meta.eventDate,
        tourDate: info.meta.tourDate,
        reservationTime: info.meta.reservationTime,
      });
    } catch {}

    return res.json({ message: already ? 'Booking was already cancelled.' : 'Booking cancelled successfully.', refund, refundPolicyPercent: percent });
  } catch (err) {
    console.error('guest cancel error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

// ---------- logged-in cancel (ORDER fixed: reverse BEFORE delete) ----------
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const auth = extractAuth(req);
    const isAdmin = auth.role === 'admin';
    const isUser  = auth.role === 'user';

    const located = await findBookingAcrossModels(id);
    if (!located) return res.status(404).json({ message: 'Booking not found' });
    const { entry, booking } = located;

    if (booking.canceled === true) return res.status(200).json({ message: 'Booking already cancelled.' });

    if (!isAdmin) {
      if (isUser) {
        const ownById    = booking.userId && String(booking.userId) === String(auth.userId);
        const ownByEmail = booking.email && auth.email && String(booking.email).toLowerCase() === String(auth.email).toLowerCase();
        if (!ownById && !ownByEmail) return res.status(403).json({ message: 'You can only cancel your own bookings.' });
      } else {
        const { email, paymentReference, reference } = req.body || {};
        const refUse = paymentReference || reference;
        if (!email || !refUse) return res.status(401).json({ message: 'Provide email and paymentReference to cancel as guest.' });
        const emailMatch = String(booking.email || '').toLowerCase() === String(email).toLowerCase();
        const refMatch   = String(booking.paymentReference || booking.reference || booking.paymentRef || '') === String(refUse);
        if (!emailMatch || !refMatch) return res.status(403).json({ message: 'Email or reference does not match this booking.' });
      }
    }

    const info = await entry.resolver(booking);
    const baseAmount = Number(booking.price || booking.total || booking.totalPrice || booking.amount || 0);
    const percent = computeRefundPercent(info.categoryLabel, booking);
    const amountNgn = Math.round((baseAmount * percent) / 100);

    let refund = { attempted: false, ok: false, provider: booking.paymentProvider, details: null };
    const provider = String(booking.paymentProvider || booking.paymentMethod || '').toLowerCase();
    const refUse = booking.paymentReference || booking.reference || booking.paymentRef;

    const canRefund =
      booking.paymentStatus === 'paid' &&
      amountNgn > 0 && refUse &&
      ['paystack', 'flutterwave'].includes(provider);

    if (canRefund) {
      refund.attempted = true;
      if (provider === 'paystack') {
        if (!process.env.PAYSTACK_SECRET_KEY) {
          refund.details = 'PAYSTACK_SECRET_KEY missing; skipped refund.';
        } else {
          const ver = await verifyPaystack(refUse);
          if (ver.ok && ver.id) {
            const rf = await refundPaystack(ver.id, amountNgn);
            refund.ok = rf.ok; refund.details = rf.data || null;
          } else refund.details = 'Verification failed; refund skipped.';
        }
      }
      if (provider === 'flutterwave') {
        if (!process.env.FLUTTERWAVE_SECRET_KEY) {
          refund.details = 'FLUTTERWAVE_SECRET_KEY missing; skipped refund.';
        } else {
          const ver = await verifyFlutter(refUse);
          if (ver.ok && ver.id) {
            const rf = await refundFlutter(ver.id, amountNgn);
            refund.ok = rf.ok; refund.details = rf.data || null;
          } else refund.details = 'Verification failed; refund skipped.';
        }
      }
    }

    
    await reverseBookingEarnings({ booking, category: entry.category }).catch(() => {});
   

    const update = {};
    if (Object.prototype.hasOwnProperty.call(booking, 'canceled')) update.canceled = true;
    if (Object.prototype.hasOwnProperty.call(booking, 'cancellationDate')) update.cancellationDate = new Date();
    if (Object.keys(update).length) await entry.Model.updateOne({ _id: id }, { $set: update });

    if (await ledgerHasAnyForBooking(id)) await deleteLedgerForBooking(id);

    try {
      await sendCancellationEmails({
        category: info.categoryLabel,
        userEmail: info.userEmail,
        vendorEmail: info.vendorEmail,
        adminEmail: info.adminEmail,
        title: info.title,
        subTitle: info.subTitle,
        fullName: info.meta.fullName,
        phone: info.meta.phone,
        guests: info.meta.guests,
        checkIn: info.meta.checkIn,
        checkOut: info.meta.checkOut,
        eventDate: info.meta.eventDate,
        tourDate: info.meta.tourDate,
        reservationTime: info.meta.reservationTime,
      });
    } catch {}

    return res.json({ message: 'Booking cancelled successfully.', refund, refundPolicyPercent: percent });
  } catch (err) {
    console.error('❌ Cancel booking error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

module.exports = router;

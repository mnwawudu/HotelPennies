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

// ───────── safe requires to avoid crashes if some services aren’t enabled ─────────
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
const Chop       = safeRequire('../models/chopModel');
const Gift       = safeRequire('../models/giftModel');

// ───────── config ─────────
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const CANCEL_SECRET = process.env.CANCEL_SECRET || process.env.JWT_SECRET || 'hp_cancel_secret';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const CANCEL_PAGE_PATH = process.env.CANCEL_PAGE_PATH || '/manage-booking/cancel';

// ───────── mailer ─────────
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
  const text =
`We received a request to cancel your booking.

Click this link to continue:
${primaryLink}

If that doesn’t open, try this link:
${fallbackLink}

If you didn’t request this, you can ignore this email.`;
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5">
    <p>We received a request to cancel your booking.</p>
    <p><a href="${primaryLink}" style="display:inline-block;background:#0a3d62;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Cancel my booking</a></p>
    <p>If that doesn’t open, try this link:</p>
    <p style="word-break:break-all"><a href="${fallbackLink}">${fallbackLink}</a></p>
    <p>If you didn’t request this, you can ignore this email.</p>
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

/** STRICT refund policy (sync with your terms) */
function computeRefundPercent(categoryLabel, booking) {
  const now = new Date();
  const startRaw =
    booking.checkIn ||
    booking.reservationTime ||
    booking.tourDate ||
    booking.eventDate;
  if (!startRaw) return 0;

  const start = new Date(startRaw);
  const hoursToStart = (start - now) / (1000 * 60 * 60);
  const cat = String(categoryLabel || '').toLowerCase();

  // 3.3 Event Centers
  if (cat.includes('event')) {
    if (hoursToStart >= 24 * 7) return 100; // ≥ 7 days
    if (hoursToStart >= 48)     return 50;  // 7d → 48h
    return 0;                                // < 48h
  }

  // 3.4 Tour Guides
  if (cat.includes('tour')) {
    if (hoursToStart > 48) return 100;     // > 48h
    if (hoursToStart > 24) return 50;      // 48h → 24h
    return 0;                              // ≤ 24h
  }

  // Lodging – unchanged (7d/48h/0)
  if (cat.includes('hotel') || cat.includes('shortlet') || cat.includes('lodging')) {
    if (hoursToStart >= 24 * 7) return 100;
    if (hoursToStart >= 48)     return 50;
    return 0;
  }

  // Restaurant – 50% if ≥24h else 0
  if (cat.includes('restaurant')) return hoursToStart >= 24 ? 50 : 0;

  return 0;
}

// ───────── finders (span all booking models) ─────────
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

// Ledger helpers
async function deleteLedgerForBooking(bookingId) {
  const _id = new mongoose.Types.ObjectId(bookingId);
  await Ledger.deleteMany({ bookingId: _id });
}
async function ledgerHasAnyForBooking(bookingId) {
  const _id = new mongoose.Types.ObjectId(bookingId);
  return !!(await Ledger.exists({ bookingId: _id }));
}

const SEARCHERS = [
  {
    category: 'hotel',
    Model: HotelBooking,
    resolver: async (booking) => {
      let roomDoc = null, hotelDoc = null;
      if (Room && booking.room)   roomDoc  = await Room.findById(booking.room).select('name vendorId').lean();
      if (Hotel && booking.hotel) hotelDoc = await Hotel.findById(booking.hotel).select('name').lean();
      const vendorId    = roomDoc?.vendorId || null;
      const vendorEmail = vendorId ? (await Vendor.findById(vendorId).select('email').lean())?.email : null;
      return {
        categoryLabel: 'Hotel',
        userEmail: booking.email,
        vendorEmail,
        adminEmail: process.env.ADMIN_EMAIL,
        title: hotelDoc?.name || 'Hotel',
        subTitle: roomDoc?.name || 'Room',
        meta: {
          fullName: booking.fullName, phone: booking.phone,
          checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests
        },
        payeeVendorId: vendorId,
      };
    }
  },
  {
    category: 'shortlet',
    Model: ShortletBooking,
    resolver: async (booking) => {
      const s = Shortlet && booking.shortlet ? await Shortlet.findById(booking.shortlet).select('name vendorId').lean() : null;
      const vendorId    = s?.vendorId || null;
      const vendorEmail = vendorId ? (await Vendor.findById(vendorId).select('email').lean())?.email : null;
      return {
        categoryLabel: 'Shortlet',
        userEmail: booking.email,
        vendorEmail,
        adminEmail: process.env.ADMIN_EMAIL,
        title: s?.name || 'Shortlet',
        subTitle: '',
        meta: {
          fullName: booking.fullName, phone: booking.phone,
          checkIn: booking.checkIn, checkOut: booking.checkOut, guests: booking.guests
        },
        payeeVendorId: vendorId,
      };
    }
  },
  {
    category: 'event',
    Model: EventBooking,
    resolver: async (booking) => {
      const ecId = booking.eventCenter || booking.eventCenterId;
      const ev = EventCtr && ecId ? await EventCtr.findById(ecId).select('name vendorId').lean() : null;
      const vendorId    = ev?.vendorId || null;
      const vendorEmail = vendorId ? (await Vendor.findById(vendorId).select('email').lean())?.email : null;
      return {
        categoryLabel: 'Event Center',
        userEmail: booking.email,
        vendorEmail,
        adminEmail: process.env.ADMIN_EMAIL,
        title: ev?.name || 'Event Center',
        subTitle: '',
        meta: {
          fullName: booking.fullName, phone: booking.phone,
          eventDate: booking.eventDate, guests: booking.guests
        },
        payeeVendorId: vendorId,
      };
    }
  },
  {
    category: 'restaurant',
    Model: RestaurantBooking,
    resolver: async (booking) => {
      const restId = booking.restaurant || booking.restaurantId;
      const rest = Restaurant && restId ? await Restaurant.findById(restId).select('name vendorId').lean() : null;
      const vendorId    = rest?.vendorId || null;
      const vendorEmail = vendorId ? (await Vendor.findById(vendorId).select('email').lean())?.email : null;
      return {
        categoryLabel: 'Restaurant',
        userEmail: booking.email,
        vendorEmail,
        adminEmail: process.env.ADMIN_EMAIL,
        title: rest?.name || 'Restaurant',
        subTitle: '',
        meta: {
          fullName: booking.fullName, phone: booking.phone,
          reservationTime: booking.reservationTime, guests: booking.guests
        },
        payeeVendorId: vendorId,
      };
    }
  },
  {
    category: 'tour',
    Model: TourBooking,
    resolver: async (booking) => {
      const guide = TourGuide && booking.guideId ? await TourGuide.findById(booking.guideId).select('name vendorId').lean() : null;
      const vendorId    = guide?.vendorId || null;
      const vendorEmail = vendorId ? (await Vendor.findById(vendorId).select('email').lean())?.email : null;
      return {
        categoryLabel: 'Tour Guide',
        userEmail: booking.email,
        vendorEmail,
        adminEmail: process.env.ADMIN_EMAIL,
        title: guide?.name || 'Tour Guide',
        subTitle: '',
        meta: {
          fullName: booking.fullName, phone: booking.phone,
          tourDate: booking.tourDate, guests: booking.numberOfGuests
        },
        payeeVendorId: vendorId,
      };
    }
  },
  {
    category: 'chops',
    Model: ChopsBooking,
    resolver: async (booking) => ({
      categoryLabel: 'Chops',
      userEmail: booking.email,
      vendorEmail: null,
      adminEmail: process.env.ADMIN_EMAIL,
      title: 'Chops',
      subTitle: '',
      meta: { fullName: booking.fullName, phone: booking.phone },
      payeeVendorId: null,
    })
  },
  {
    category: 'gifts',
    Model: GiftBooking,
    resolver: async (booking) => ({
      categoryLabel: 'Gift',
      userEmail: booking.email,
      vendorEmail: null,
      adminEmail: process.env.ADMIN_EMAIL,
      title: 'Gift',
      subTitle: '',
      meta: { fullName: booking.fullName, phone: booking.phone },
      payeeVendorId: null,
    })
  },
].filter(Boolean);

async function findBookingAcrossModels(id) {
  for (const entry of SEARCHERS) {
    if (!entry?.Model) continue;
    const doc = await entry.Model.findById(id).lean();
    if (doc) return { entry, booking: doc };
  }
  return null;
}

// ───────── guest token ─────────
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

    const mail = await sendMagicLinkEmail(emailLower, linkPrimary, linkFallback).catch(e => ({ sent:false, error:e?.message }));

    return res.json({ ok: true, message: mail.sent ? 'We emailed you a secure cancel link.' : 'Cancel link generated.', link: linkPrimary, altLink: linkFallback });
  } catch (err) {
    console.error('cancel-token error', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Could not create cancel link' });
  }
});

// ───────── refund preview for UI ─────────
router.get('/:id/refund-preview', async (req, res) => {
  try {
    const { id } = req.params;
    const auth = extractAuth(req);
    if (auth.role !== 'user') return res.status(403).json({ message: 'User auth required' });

    const located = await findBookingAcrossModels(id);
    if (!located) return res.status(404).json({ message: 'Booking not found' });

    const { entry, booking } = located;
    const ownById    = booking.userId && String(booking.userId) === String(auth.userId);
    const ownByEmail = booking.email && auth.email && String(booking.email).toLowerCase() === String(auth.email).toLowerCase();
    if (!ownById && !ownByEmail) return res.status(403).json({ message: 'This booking is not yours' });

    const info = await entry.resolver(booking);
    const baseAmount = Number(booking.price || booking.total || booking.totalPrice || booking.amount || 0);
    const percent = computeRefundPercent(info.categoryLabel, booking);
    const amountNgn = Math.round((baseAmount * percent) / 100);

    return res.json({ baseAmount, percent, amountNgn });
  } catch {
    res.status(500).json({ message: 'Failed to preview refund' });
  }
});

// ───────── guest cancel ─────────
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

    const emailMatch = String(booking.email || '').toLowerCase() === String(payload.email || '').toLowerCase();
    const refMatch   = String(booking.paymentReference || booking.reference || booking.paymentRef || '') === String(payload.ref || '');
    if (!emailMatch || !refMatch) return res.status(403).json({ message: 'Email/reference mismatch.' });

    const info = await entry.resolver(booking);
    const baseAmount = Number(booking.price || booking.total || booking.totalPrice || booking.amount || 0);
    const percent = computeRefundPercent(info.categoryLabel, booking);
    const amountNgn = Math.round((baseAmount * percent) / 100);

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

    if (await ledgerHasAnyForBooking(payload.bid)) await deleteLedgerForBooking(payload.bid);
    const catForReverse = entry.category === 'shortlet' ? 'shortlet' : entry.category === 'hotel' ? 'hotel' : entry.category;
    await reverseBookingEarnings({ booking, category: catForReverse }).catch(() => {});

    if (!already) {
      const update = {};
      if (Object.prototype.hasOwnProperty.call(booking, 'canceled')) update.canceled = true;
      if (Object.prototype.hasOwnProperty.call(booking, 'cancellationDate')) update.cancellationDate = new Date();
      if (Object.keys(update).length) await entry.Model.updateOne({ _id: payload.bid }, { $set: update });
    }

    // ✅ include itinerary in emails
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
    }).catch(() => {});

    return res.json({ message: already ? 'Booking was already cancelled.' : 'Booking cancelled successfully.', refund, refundPolicyPercent: percent });
  } catch (err) {
    console.error('guest cancel error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

// ───────── logged-in cancel ─────────
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

    if (await ledgerHasAnyForBooking(id)) await deleteLedgerForBooking(id);
    const catForReverse = entry.category === 'shortlet' ? 'shortlet' : entry.category === 'hotel' ? 'hotel' : entry.category;
    await reverseBookingEarnings({ booking, category: catForReverse }).catch(() => {});

    const update = {};
    if (Object.prototype.hasOwnProperty.call(booking, 'canceled')) update.canceled = true;
    if (Object.prototype.hasOwnProperty.call(booking, 'cancellationDate')) update.cancellationDate = new Date();
    if (Object.keys(update).length) await entry.Model.updateOne({ _id: id }, { $set: update });

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
    }).catch(() => {});

    return res.json({ message: 'Booking cancelled successfully.', refund, refundPolicyPercent: percent });
  } catch (err) {
    console.error('❌ Cancel booking error:', err?.response?.data || err.message || err);
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

module.exports = router;

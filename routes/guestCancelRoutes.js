// routes/guestCancelRoutes.js — token-only + cancel-with-token + deep debug
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Safe requires (don’t crash if some models don’t exist locally)
function safeRequire(p) { try { return require(p); } catch { return null; } }
const Ledger              = safeRequire('../models/ledgerModel');
const HotelBooking        = safeRequire('../models/hotelBookingModel');
const ShortletBooking     = safeRequire('../models/shortletBookingModel');
const RestaurantBooking   = safeRequire('../models/restaurantBookingModel');
const EventCenterBooking  = safeRequire('../models/eventCenterBookingModel');
const TourGuideBooking    = safeRequire('../models/tourGuideBookingModel');
const ChopsBooking        = safeRequire('../models/chopsBookingModel');
const GiftBooking         = safeRequire('../models/giftBookingModel');

const { reverseBookingEarnings } = safeRequire('../utils/reverseBookingEarnings') || { reverseBookingEarnings: async () => {} };

// ---- config
const APP_URL           = process.env.APP_URL || 'http://localhost:3000';
const CANCEL_SECRET     = process.env.CANCEL_SECRET || process.env.JWT_SECRET || 'hp_cancel_secret';
const PAYSTACK_SECRET   = process.env.PAYSTACK_SECRET_KEY || '';
const CANCEL_PAGE_PATH  = process.env.CANCEL_PAGE_PATH || '/manage-booking/cancel';

// ---- email transport (for magic link)
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
    console.warn('[guestCancel] SMTP not configured; returning link in response (dev only).');
    return { sent: false, reason: 'smtp_missing' };
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

// ---- helpers
const MODELS = [
  { name: 'HotelBooking',       M: HotelBooking },
  { name: 'ShortletBooking',    M: ShortletBooking },
  { name: 'RestaurantBooking',  M: RestaurantBooking },
  { name: 'EventCenterBooking', M: EventCenterBooking },
  { name: 'TourGuideBooking',   M: TourGuideBooking },
  { name: 'ChopsBooking',       M: ChopsBooking },
  { name: 'GiftBooking',        M: GiftBooking },
].filter(x => !!x.M);

const catFor = (modelName) => ({
  HotelBooking: 'hotel',
  ShortletBooking: 'shortlet',
  RestaurantBooking: 'restaurant',
  EventCenterBooking: 'event',
  TourGuideBooking: 'tour',
  ChopsBooking: 'chops',
  GiftBooking: 'gifts',
}[modelName] || 'hotel');

const digitsOnly = (s) => String(s || '').replace(/\D+/g, '');

function buildFindQuery(reference, emailLower) {
  const ref = String(reference || '').trim();
  const refDigits = digitsOnly(ref);

  const refFields = [
    'paymentReference','reference','ref','paymentRef',
    'transactionReference','transaction_ref','tx_ref','txRef',
    'metadata.reference','paystack.reference',
    'referenceNumber','bookingReference','referenceNo','refNo',
  ];

  const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ors = [
    ...refFields.map(f => ({ [f]: ref })),
    ...refFields.map(f => ({ [f]: { $regex: esc, $options: 'i' } })),
  ];

  if (refDigits) {
    const escD = refDigits.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    ors.push(...refFields.map(f => ({ [f]: refDigits })));
    ors.push(...refFields.map(f => ({ [f]: { $regex: escD, $options: 'i' } })));
  }

  const emailOr = emailLower ? [
    { email: emailLower },
    { buyerEmail: emailLower },
    { customerEmail: emailLower },
    { contactEmail: emailLower },
    { 'customer.email': emailLower },
  ] : [];

  return emailOr.length ? { $and: [{ $or: ors }, { $or: emailOr }] } : { $or: ors };
}

async function fetchEmailFromPaystack(reference) {
  if (!PAYSTACK_SECRET || !reference) return null;
  try {
    const r = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const data = r?.data?.data || {};
    return (data?.customer?.email ? String(data.customer.email).toLowerCase().trim() : null);
  } catch (e) {
    console.warn('[guestCancel] verify@paystack failed:', e?.response?.data || e?.message || e);
    return null;
  }
}

async function markCancelled(doc) {
  try {
    if ('canceled' in doc) doc.canceled = true;
    if ('status' in doc) doc.status = 'cancelled';
    if ('bookingStatus' in doc) doc.bookingStatus = 'cancelled';
    if ('canceledAt' in doc) doc.canceledAt = new Date();

    doc.set('canceled', true, { strict: false });
    doc.set('canceledAt', new Date(), { strict: false });
    doc.set('status', 'cancelled', { strict: false });

    await doc.save();
    return true;
  } catch (e) {
    console.warn('[guestCancel] markCancelled failed:', e?.message || e);
    return false;
  }
}

async function deleteLedgerForBooking(bookingId) {
  if (!Ledger) return;
  try {
    const _id = new mongoose.Types.ObjectId(String(bookingId));
    const res = await Ledger.deleteMany({ bookingId: _id });
    console.log(`[guestCancel] ledger deleteMany bookingId=${_id} →`, res?.deletedCount);
  } catch (e) {
    console.warn('[guestCancel] ledger delete failed:', e?.message || e);
  }
}

console.log('✅ [guestCancel] router loaded (token-only & cancel-with-token)');

/**
 * POST /cancel-token
 * Body: { email?: string, paymentReference?: string, reference?: string }
 * -> Only validates + finds booking and emails a magic link. DOES NOT cancel here.
 */
router.post('/cancel-token', async (req, res) => {
  const t0 = Date.now();
  try {
    let { email, paymentReference, reference } = req.body || {};
    const ref = String(paymentReference || reference || '').trim();
    let emailLower = String(email || '').toLowerCase().trim();

    console.log('— — — — — [guestCancel] /cancel-token request');
    console.log('  email      =', emailLower || '(empty)');
    console.log('  reference  =', ref || '(empty)');
    if (!ref) return res.status(400).json({ message: 'paymentReference is required' });

    if (!emailLower) {
      emailLower = await fetchEmailFromPaystack(ref);
      console.log('  paystack.email =', emailLower || '(none)');
      if (!emailLower) return res.status(400).json({ message: 'email is required' });
    }

    const q = buildFindQuery(ref, emailLower);
    console.log('  built query =', JSON.stringify(q));

    let foundId = null;
    let modelName = null;

    for (const { name, M } of MODELS) {
      try {
        const count = await M.countDocuments(q).exec();
        console.log(`  [scan] ${name}.count = ${count}`);
        if (count > 0) {
          const doc = await M.findOne(q).select('_id').lean();
          if (doc?._id) { foundId = String(doc._id); modelName = name; }
          break;
        }
      } catch (e) {
        console.warn(`  [scan] ${name} error:`, e?.message || e);
      }
    }

    if (!foundId) {
      console.log('  [result] NOT FOUND → 404');
      return res.status(404).json({ message: 'No matching booking found for the provided reference/email' });
    }

    const token = jwt.sign({ p: 'guest_cancel', bid: foundId, email: emailLower, ref }, CANCEL_SECRET, { expiresIn: '2h' });
    const linkPrimary  = `${APP_URL}${CANCEL_PAGE_PATH}?t=${encodeURIComponent(token)}`;
    const linkFallback = `${APP_URL}/manage-booking/cancel?t=${encodeURIComponent(token)}`;

    const mail = await sendMagicLinkEmail(emailLower, linkPrimary, linkFallback).catch(e => ({ sent: false, reason: e?.message }));

    console.log(`  [token] for ${modelName}#${foundId} → emailed=${mail.sent} (${Date.now()-t0}ms)`);
    const payload = { ok: true, message: mail.sent ? 'We emailed you a secure cancel link.' : 'Cancel link generated.' };
    // Dev convenience: return link so you can click it immediately
    if (process.env.NODE_ENV !== 'production') payload.link = linkPrimary;
    return res.json(payload);
  } catch (err) {
    console.error('❌ [guestCancel] /cancel-token error:', err?.response?.data || err.message || err);
    return res.status(500).json({ message: 'Could not create cancel link' });
  }
});

/**
 * POST /guest/cancel
 * Body: { token: string }
 * -> VERIFIED cancel: marks cancelled, reverses cashback/referral, wipes ledger rows.
 */
router.post('/cancel', async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ message: 'token is required' });

    let payload;
    try { payload = jwt.verify(token, CANCEL_SECRET); }
    catch { return res.status(401).json({ message: 'Invalid or expired token' }); }

    if (payload?.p !== 'guest_cancel' || !payload?.bid) {
      return res.status(400).json({ message: 'Malformed token' });
    }

    let found = null;
    let usedModel = null;
    for (const { name, M } of MODELS) {
      const doc = await M.findById(payload.bid);
      if (doc) { found = doc; usedModel = name; break; }
    }
    if (!found) return res.status(404).json({ message: 'Booking not found' });

    // sanity: email/ref must still match (protects against token/record drift)
    const emailMatch = String(found.email || '').toLowerCase() === String(payload.email || '').toLowerCase();
    const refMatch = [found.paymentReference, found.reference, found.paymentRef]
      .map(x => String(x || ''))
      .some(v => !!v && v === String(payload.ref || ''));
    if (!emailMatch || !refMatch) {
      return res.status(403).json({ message: 'Email/reference mismatch.' });
    }

    const already =
      found.canceled === true ||
      String(found.status || '').toLowerCase().includes('cancel') ||
      String(found.bookingStatus || '').toLowerCase().includes('cancel');

    if (!already) {
      // 1) mark cancelled
      await markCancelled(found);
      // 2) reverse user rewards (cashback + referral commission), category-aware
      const cat = catFor(usedModel);
      console.log(`[guestCancel] reverseBookingEarnings category=${cat} for booking=${found._id}`);
      await reverseBookingEarnings({ booking: found, category: cat }).catch(e =>
        console.warn('[guestCancel] reverseBookingEarnings failed:', e?.message || e)
      );
      // 3) wipe ledger rows tied to this booking (vendor/admin/user/referral)
      await deleteLedgerForBooking(found._id);
    } else {
      console.log('[guestCancel] idempotent: already cancelled.');
    }

    return res.json({
      ok: true,
      message: already ? 'Booking was already cancelled' : 'Booking cancelled successfully',
      category: catFor(usedModel),
      bookingId: String(found._id),
    });
  } catch (err) {
    console.error('❌ [guestCancel] /cancel error:', err?.response?.data || err.message || err);
    return res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

module.exports = router;

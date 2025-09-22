// routes/eventCenterBookingRoutes.js
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

const EventCenterBooking = require('../models/eventCenterBookingModel');
const EventCenter = require('../models/eventCenterModel');
const Vendor = require('../models/vendorModel');
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');

const { recordBookingLedger, releasePendingForBooking } = require('../services/ledgerService');
const sendBookingEmails = require('../utils/sendBookingEmails');
const rewardReferral = require('../utils/referralReward');
const configService = require('../services/configService');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const asFrac = (v) => Number(v || 0);
const pctOf = (amount, frac) => Math.round(Number(amount) * Number(frac || 0));
const looksLikeId = (s) => typeof s === 'string' && /^[0-9a-fA-F]{24}$/.test(s);
const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function formatDateOnly(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function val(v) {
  if (v == null) return undefined;
  if (typeof v === 'string' && v.trim() === '') return undefined;
  return v;
}

async function findUserByAny({ id, code, email }) {
  if (looksLikeId(id)) {
    const u = await User.findById(id).select('_id').lean();
    if (u) return { id: String(u._id), matchedBy: 'id' };
  }
  if (val(code)) {
    const u = await User.findOne({ userCode: String(code).trim() }).select('_id').lean();
    if (u) return { id: String(u._id), matchedBy: 'code' };
  }
  if (val(email)) {
    const u = await User.findOne({ email: String(email).trim().toLowerCase() }).select('_id').lean();
    if (u) return { id: String(u._id), matchedBy: 'email' };
  }
  return { id: null, matchedBy: null };
}

async function resolveReferrer({ body = {}, query = {}, buyerUser = null, buyerEmail = '', paystackMeta = null }) {
  // 1) Direct objectId-ish from body/query
  const directIds = [
    body.referredByUserId, body.referrerId, body.referralUserId,
    body.referredBy, body.refId, query?.referrerId, query?.referredByUserId,
  ].filter(Boolean);

  for (const candidate of directIds) {
    const found = await findUserByAny({ id: candidate });
    if (found.id) return { ...found, matchedBy: 'body_or_query_id' };
  }

  // 2) Codes from body/query
  const codeCandidates = [
    body.referralCode, body.refCode, body.referredByCode,
    query?.referralCode, query?.ref,
  ].filter(Boolean);

  for (const code of codeCandidates) {
    const found = await findUserByAny({ code });
    if (found.id) return { ...found, matchedBy: 'body_or_query_code' };
  }

  // 3) Emails from body/query
  const emailCandidates = [
    body.referrerEmail, body.referredByEmail, query?.referrerEmail,
  ].filter(Boolean);

  for (const em of emailCandidates) {
    const found = await findUserByAny({ email: em });
    if (found.id) return { ...found, matchedBy: 'body_or_query_email' };
  }

  // 4) buyerUser.referredBy (not self)
  if (looksLikeId(buyerUser?.referredBy) && String(buyerUser.referredBy) !== String(buyerUser?._id || '')) {
    return { id: String(buyerUser.referredBy), matchedBy: 'buyerUser.referredBy' };
  }

  // 5) someone whose referredEmails[] contains buyerEmail (case-insensitive)
  if (buyerEmail) {
    const inviter = await User.findOne({
      referredEmails: { $elemMatch: { $regex: new RegExp(`^${escapeRegex(buyerEmail)}$`, 'i') } },
    }).select('_id').lean();
    if (inviter) return { id: String(inviter._id), matchedBy: 'referredEmails' };
  }

  // 6) Paystack metadata (flat + custom_fields)
  let meta = paystackMeta;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { meta = null; }
  }

  if (meta && typeof meta === 'object') {
    // 6a) flat keys
    const fromMeta = {
      id:    meta.referrerId || meta.referredByUserId || meta.referralUserId || meta.refUserId,
      code:  meta.referralCode || meta.ref || meta.refCode || meta.referredByCode,
      email: meta.referrerEmail || meta.referredByEmail,
    };
    const foundMeta = await findUserByAny(fromMeta);
    if (foundMeta.id) return { ...foundMeta, matchedBy: 'paystack.meta' };

    // 6b) custom_fields
    const cf = Array.isArray(meta.custom_fields) ? meta.custom_fields : [];
    if (cf.length) {
      const kvs = {};
      for (const item of cf) {
        const k = String(item?.key || item?.display_name || '').trim().toLowerCase();
        const v = item?.value ?? item?.text ?? item?.value_text ?? null;
        if (!k || v == null) continue;
        kvs[k] = v;
      }
      const viaCustom = {
        id:
          kvs['referrerid'] ||
          kvs['referredbyuserid'] ||
          kvs['referraluserid'] ||
          kvs['refuserid'] ||
          kvs['referrer_id'] ||
          kvs['referred_by_user_id'] ||
          kvs['referral_user_id'],
        code:
          kvs['referralcode'] ||
          kvs['ref'] ||
          kvs['refcode'] ||
          kvs['referredbycode'] ||
          kvs['referral_code'],
        email:
          kvs['referreremail'] ||
          kvs['referredbyemail'] ||
          kvs['referrer_email'],
      };
      const foundCustom = await findUserByAny(viaCustom);
      if (foundCustom.id) return { ...foundCustom, matchedBy: 'paystack.meta.custom_fields' };
    }
  }

  return { id: null, matchedBy: null };
}


router.post('/', async (req, res) => {
  try {
    const {
      eventCenterId,
      fullName,
      email,
      phone,
      eventDate,
      guests,
      paymentRef,
      paymentMethod,
      amount,
      buyerUserId: buyerUserIdFromBody,
    } = req.body;

    if (!eventCenterId || !fullName || !email || !phone || !eventDate || !guests || !paymentRef || !paymentMethod || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Load live knobs
    const cfg = await configService.load();
    const eventCashbackFrac = asFrac(cfg.cashbackPctEventCenter ?? cfg.cashbackPctEvent ?? 0);
    const eventReferralFrac = asFrac(cfg.referralPctEventCenter ?? cfg.referralPctEvent ?? 0);
    const platformFrac      = asFrac(cfg.platformPctEventCenter ?? cfg.platformPctDefault ?? 0.15);

    // Event center
    const eventCenter = await EventCenter.findById(eventCenterId);
    if (!eventCenter) return res.status(404).json({ error: 'Event center not found' });

    // Availability
    const formattedEventDate = formatDateOnly(eventDate);
    const normalizedUnavailable = (eventCenter.unavailableDates || []).map(formatDateOnly);
    if (normalizedUnavailable.includes(formattedEventDate)) {
      return res.status(400).json({ error: 'Selected date is unavailable. Please choose another date.' });
    }

    // Verify payment (Paystack) — do not change this endpoint/shape
    const verifyUrl = `https://api.paystack.co/transaction/verify/${paymentRef}`;
    const verifyRes = await axios.get(verifyUrl, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
    const { status, data } = verifyRes.data || {};
    if (!status || data?.status !== 'success') {
      return res.status(400).json({ error: 'Payment not verified or failed' });
    }

   let paystackMeta = data?.metadata || null;
if (typeof paystackMeta === 'string') {
  try { paystackMeta = JSON.parse(paystackMeta); } catch { /* ignore */ }
}


    // Save booking
    const buyerEmail = String(email || '').trim().toLowerCase();
    const newBooking = new EventCenterBooking({
      eventCenterId,
      vendorId: eventCenter.vendorId,
      fullName,
      email: buyerEmail,
      phone,
      eventDate,
      guests,
      paymentRef,
      paymentMethod,
      amount,
      paymentStatus: 'paid',
    });
    await newBooking.save();

    // Emails
    try {
      let vendorEmail = null;
      try {
        if (eventCenter.vendorId) {
          const v = await Vendor.findById(eventCenter.vendorId).select('email').lean();
          vendorEmail = v?.email || null;
        }
      } catch {}
      await sendBookingEmails({
        category: 'event',
        title: eventCenter.name || eventCenter.title || 'Event Center',
        userEmail: buyerEmail,
        vendorEmail,
        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL,
        fullName, phone, guests, amount, paymentReference: paymentRef, eventDate,
      });
      console.log('✅ Booking email sent.');
    } catch (_) {}

    // Legacy vendor payout list
    try {
      const vendor = eventCenter.vendorId ? await Vendor.findById(eventCenter.vendorId).exec() : null;
      if (vendor) {
        const vendorShare = pctOf(amount, 1 - platformFrac);
        vendor.payoutHistory = vendor.payoutHistory || [];
        vendor.payoutHistory.push({ amount: vendorShare, account: {}, status: 'pending', date: new Date() });
        await vendor.save();
        console.log(`🏦 Vendor credited (pending) ${vendor.email} +${vendorShare}`);
      }
    } catch (e) {
      console.warn('⚠️ Vendor payout failed:', e?.message || e);
    }

    // Resolve buyer (JWT → body → email)
    let authUser = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) authUser = await User.findById(decoded.id).exec();
      } catch {}
    }
    let buyerUser = authUser;
    if (!buyerUser && buyerUserIdFromBody) {
      try { buyerUser = await User.findById(buyerUserIdFromBody).exec(); } catch {}
    }
    if (!buyerUser) buyerUser = await User.findOne({ email: buyerEmail }).exec();

    const buyerAccountEmail = (buyerUser?.email || buyerEmail).toLowerCase();
    const buyerPaidCount = await EventCenterBooking.countDocuments({
      email: buyerAccountEmail, paymentStatus: 'paid', canceled: { $ne: true },
    });

    // **ROOT-CAUSE FIX** — resolve referrer from BODY/QUERY/**PAYSTACK METADATA**
    const { id: refCandidateUserId, matchedBy } =
      await resolveReferrer({ body: req.body, query: req.query, buyerUser, buyerEmail, paystackMeta });

    const selfReferral = buyerUser && refCandidateUserId && String(refCandidateUserId) === String(buyerUser._id);
    const referralEligible = !!refCandidateUserId && !selfReferral && eventReferralFrac > 0;

    console.log('🎯 [event] referrer resolution:', {
      matchedBy,
      refCandidateUserId: refCandidateUserId || null,
      referralEligible,
      knobs: { referralPct: eventReferralFrac * 100 }
    });

    // Try to post referral earning (best-effort)
    if (referralEligible) {
      try {
        await rewardReferral({
          buyerEmail: buyerAccountEmail,
          bookingId: newBooking._id,
          price: Number(amount),
          referrerId: refCandidateUserId,
        });
      } catch (e) {
        console.warn('⚠️ rewardReferral failed softly:', e?.message || e);
      }
    }

    // Cashback (block first booking if already referred by someone)
    let cashbackApplied = false;
    if (buyerUser && eventCashbackFrac > 0) {
      const referredById = buyerUser.referredBy ? String(buyerUser.referredBy) : null;
      const isFirstBookingAndReferred =
        buyerPaidCount === 1 && !!referredById && referredById !== String(buyerUser._id);

      if (!isFirstBookingAndReferred) {
        try {
          const cbAmount = pctOf(amount, eventCashbackFrac);
          buyerUser.earnings = Array.isArray(buyerUser.earnings) ? buyerUser.earnings : (buyerUser.earnings ? [buyerUser.earnings] : []);
          buyerUser.payoutStatus = buyerUser.payoutStatus || {};
          buyerUser.earnings.push({ amount: cbAmount, source: 'transaction', sourceId: newBooking._id, status: 'pending' });
          buyerUser.payoutStatus.totalEarned = (buyerUser.payoutStatus.totalEarned || 0) + cbAmount;
          buyerUser.payoutStatus.currentBalance = (buyerUser.payoutStatus.currentBalance || 0) + cbAmount;
          await buyerUser.save();
          cashbackApplied = true;
        } catch (e) {
          console.warn('⚠️ Cashback apply failed softly:', e?.message || e);
        }
      }
    }

    // LEDGER — pass referralUserId **iff we actually resolved it** (that’s what creates the user commission row)
    try {
      const ledgerCashbackEligible = cashbackApplied;
      const ledgerReferralUserId   = referralEligible ? refCandidateUserId : null;

      console.log('[ledger:recordBookingLedger:req]', {
        bookingId: String(newBooking._id),
        vendorId: eventCenter.vendorId ? String(eventCenter.vendorId) : null,
        userId: buyerUser ? String(buyerUser._id) : null,
        totalCost: Number(amount),
        category: 'event_center',
        catNorm: 'event_center',
        cashbackEligible: ledgerCashbackEligible,
        referralUserId: ledgerReferralUserId,
        splitKind: ledgerReferralUserId ? 'referral' : (ledgerCashbackEligible ? 'cashback' : 'none'),
      });

      await recordBookingLedger(
        {
          _id: newBooking._id,
          userId: buyerUser ? buyerUser._id : null,
          vendorId: eventCenter.vendorId || null,
          totalCost: Number(amount),
          checkInDate: eventDate ? new Date(eventDate) : null,
          checkOutDate: eventDate ? new Date(eventDate) : null,
          cashbackEligible: ledgerCashbackEligible,
          referralUserId: ledgerReferralUserId,   // ← THIS is what triggers user commission in ledger
          type: 'event_center',
        },
        { category: 'event_center' }
      );

      const count = await Ledger.countDocuments({ bookingId: newBooking._id });
      console.log('[ledger:recordBookingLedger:ok]', { bookingId: String(newBooking._id), count });
    } catch (e) {
      console.error('⚠️ recordBookingLedger failed (booking continues):', e.message);
    }

    return res.status(201).json({ message: 'Booking confirmed', booking: newBooking });
  } catch (err) {
    const error = err?.response?.data?.error || err?.message || '❌ Failed to confirm booking. Please try again.';
    console.error('❌ Booking failed:', error);
    return res.status(500).json({ error });
  }
});

/* lifecycle endpoints */
router.post('/:id/check-in', async (req, res) => {
  const b = await EventCenterBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  try { b.serviceStatus = 'checked_in'; b.checkInDate = b.checkInDate || new Date(); await b.save(); } catch {}
  res.json({ ok: true });
});

router.post('/:id/check-out', async (req, res) => {
  const b = await EventCenterBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });
  try { b.serviceStatus = 'checked_out'; b.checkOutDate = b.checkOutDate || new Date(); await b.save(); } catch {}
  const released = await releasePendingForBooking(b._id);
  res.json({ ok: true, released });
});

router.patch('/:id/cancel', async (req, res) => {
  try {
    const { email } = req.body;
    const booking = await EventCenterBooking.findById(req.params.id).populate('eventCenterId').exec();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.canceled) return res.status(400).json({ error: 'Booking already canceled' });
    if (!email || String(booking.email || '').toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match booking owner' });
    }
    const now = new Date();
    const dateOnly = new Date(booking.eventDate);
    if (dateOnly <= now) return res.status(400).json({ error: 'Cannot cancel on/after event date' });

    try {
      const vendorCredits = await Ledger.find({
        sourceType: 'booking',
        bookingId: booking._id,
        accountType: 'vendor',
        direction: 'credit',
        reason: 'vendor_share',
      }).lean();

      if (vendorCredits && vendorCredits.length) {
        const existing = await Ledger.exists({
          sourceType: 'booking',
          bookingId: booking._id,
          accountType: 'vendor',
          direction: 'debit',
          reason: 'adjustment',
          'meta.kind': 'vendor_share_reversal',
        });
        if (!existing) {
          const byVendor = new Map();
          for (const c of vendorCredits) {
            const key = String(c.accountId);
            byVendor.set(key, (byVendor.get(key) || 0) + Number(c.amount || 0));
          }
          const toCreate = [];
          for (const [vendorId, amt] of byVendor.entries()) {
            if (amt > 0) {
              toCreate.push({
                accountType: 'vendor',
                accountId: vendorId,
                sourceType: 'booking',
                sourceModel: 'Booking',
                sourceId: booking._id,
                bookingId: booking._id,
                direction: 'debit',
                amount: amt,
                reason: 'adjustment',
                status: 'pending',
                currency: 'NGN',
                meta: { category: 'event_center', kind: 'vendor_share_reversal' },
              });
            }
          }
          if (toCreate.length) await Ledger.insertMany(toCreate);
        }
      }
    } catch (e) {
      console.warn('⚠️ [eventcenter/cancel] Vendor reversal posting failed (soft):', e.message);
    }

    booking.canceled = true;
    booking.cancellationDate = now;
    await booking.save();

    return res.status(200).json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('❌ [eventcenter/cancel] Error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;

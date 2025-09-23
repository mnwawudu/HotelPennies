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

function formatDateOnly(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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
      referredByUserId,        // ✅ like Hotels: only accept explicit ID
      buyerUserId: buyerUserIdFromBody,
    } = req.body;

    if (!eventCenterId || !fullName || !email || !phone || !eventDate || !guests || !paymentRef || !paymentMethod || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Load percents (use Event Center knobs where available)
    const cfg = await configService.load();
    const eventCashbackFrac = asFrac(cfg.cashbackPctEventCenter ?? cfg.cashbackPctEvent ?? 0);
    const eventReferralFrac = asFrac(cfg.referralPctEventCenter ?? cfg.referralPctEvent ?? 0);
    const platformFrac      = asFrac(cfg.platformPctEventCenter ?? cfg.platformPctDefault ?? 0.15);

    // Event center existence + availability
    const eventCenter = await EventCenter.findById(eventCenterId);
    if (!eventCenter) return res.status(404).json({ error: 'Event center not found' });

    const formattedEventDate = formatDateOnly(eventDate);
    const normalizedUnavailable = (eventCenter.unavailableDates || []).map(formatDateOnly);
    if (normalizedUnavailable.includes(formattedEventDate)) {
      return res.status(400).json({ error: 'Selected date is unavailable. Please choose another date.' });
    }

    // Verify payment with Paystack (keep existing verification)
    const verifyUrl = `https://api.paystack.co/transaction/verify/${paymentRef}`;
    const verifyRes = await axios.get(verifyUrl, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
    const { status, data } = verifyRes.data || {};
    if (!status || data?.status !== 'success') {
      return res.status(400).json({ error: 'Payment not verified or failed' });
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

    // Emails (user + vendor + admin)
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
    } catch (_) {}

    // Legacy vendor payout list (platform covers incentives)
    try {
      const vendor = eventCenter.vendorId ? await Vendor.findById(eventCenter.vendorId).exec() : null;
      if (vendor) {
        const vendorShare = pctOf(amount, 1 - platformFrac);
        vendor.payoutHistory = vendor.payoutHistory || [];
        vendor.payoutHistory.push({ amount: vendorShare, account: {}, status: 'pending', date: new Date() });
        await vendor.save();
      }
    } catch (e) {
      console.warn('⚠️ Vendor payout failed:', e?.message || e);
    }

    // Resolve buyer account (JWT → body → email)
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

    // Count buyer's paid Event Center bookings (category-specific, like Hotels)
    const buyerPaidCount = await EventCenterBooking.countDocuments({
      email: buyerAccountEmail, paymentStatus: 'paid', canceled: { $ne: true },
    });

    // ————————————————————————
    // REFERRAL (Hotels pattern)
    // Only act if client sent an explicit referredByUserId AND referral pct > 0
    // Then call rewardReferral, and detect if commission actually posted.
    // ————————————————————————
    let commissionPaid = false;
    let commissionRefUserId = null;
    

    if (referredByUserId && eventReferralFrac > 0) {
      try {
        await rewardReferral({
          buyerEmail: buyerAccountEmail,
          bookingId: newBooking._id,
          price: Number(amount),
          referrerId: referredByUserId,
        });

        // Inspect referrer earnings to confirm commission actually got posted
        const refUser = await User.findById(referredByUserId).select('earnings email').lean();
        if (refUser && Array.isArray(refUser.earnings)) {
          const hit = refUser.earnings.find(
            e =>
              String(e?.sourceId || '') === String(newBooking._id) &&
              String(e?.source || '').toLowerCase() === 'booking'
          );
          if (hit) {
            commissionPaid = true;
            commissionRefUserId = referredByUserId;
            
          }
        }
      } catch (e) {
        console.warn('⚠️ rewardReferral (event center) failed softly:', e?.message || e);
      }
    }

    // ————————————————————————
    // CASHBACK (Hotels pattern)
    // Block if this is the first paid booking AND buyerUser was referred by someone else.
    // ————————————————————————
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

    // ————————————————————————
    // LEDGER — mirror what actually happened (Hotels pattern)
    // referralUserId only if a commission really posted.
    // cashbackEligible only if we actually credited cashback.
    // ————————————————————————
    try {
      await recordBookingLedger(
        {
          _id: newBooking._id,
          userId: buyerUser ? buyerUser._id : null,
          vendorId: eventCenter.vendorId || null,
          totalCost: Number(amount),
          checkInDate: eventDate ? new Date(eventDate) : null,
          checkOutDate: eventDate ? new Date(eventDate) : null,
          cashbackEligible: cashbackApplied,
          referralUserId: commissionPaid ? commissionRefUserId : null,
          type: 'event_center',
        },
        { category: 'event_center' }
      );

      // optional sanity log
      try {
        const count = await Ledger.countDocuments({ bookingId: newBooking._id });
        console.log('[ledger:event_center] rows recorded =', count);
      } catch {}
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

/* lifecycle endpoints unchanged */
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
    // Resolve caller email (prefer JWT like Hotels; falls back to body.email)
    let authEmail = '';
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          const u = await User.findById(decoded.id).lean();
          if (u?.email) authEmail = String(u.email).toLowerCase();
        }
      }
    } catch {}

    const emailFromBody = String(req.body?.email || '').trim().toLowerCase();
    const candidateEmail = authEmail || emailFromBody;

    if (!candidateEmail) {
      return res.status(400).json({ error: 'Email is required or sign in to cancel.' });
    }

    const booking = await EventCenterBooking.findById(req.params.id).populate('eventCenterId').exec();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.canceled) return res.status(400).json({ error: 'Booking already canceled' });

    if (String(booking.email || '').toLowerCase() !== candidateEmail) {
      return res.status(403).json({ error: 'Email does not match booking owner' });
    }

    const now = new Date();
    const dateOnly = new Date(booking.eventDate);
    if (dateOnly <= now) return res.status(400).json({ error: 'Cannot cancel on/after event date' });

    /* ────────────────────────────────────────────────────────────
       ✅ Reverse buyer cashback (user doc + ledger adjustment)
       Mirrors hotels: source === 'transaction' with sourceId = booking._id
       ──────────────────────────────────────────────────────────── */
    try {
      const user = await User.findOne({ email: candidateEmail }).exec();
      if (user) {
        user.earnings = Array.isArray(user.earnings)
          ? user.earnings
          : (user.earnings ? [user.earnings] : []);
        user.payoutStatus = user.payoutStatus || {};

        let reversed = 0;
        let changed = false;

        user.earnings.forEach((e) => {
          const sid = String(e?.sourceId || '');
          const src = String(e?.source || '').toLowerCase();
          if (sid === String(booking._id) && e?.status !== 'reversed' && src === 'transaction') {
            reversed += Number(e?.amount || 0);
            e.status = 'reversed';
            e.reversalReason = 'booking_cancelled';
            e.reversalDate = new Date();
            changed = true;
          }
        });

        const hasNeg = user.earnings.some(
          (e) =>
            String(e?.sourceId || '') === String(booking._id) &&
            String(e?.source || '') === 'transaction_reversal'
        );
        if (changed && reversed > 0 && !hasNeg) {
          user.earnings.push({
            amount: -reversed,
            source: 'transaction_reversal',
            sourceId: booking._id,
            status: 'posted',
            createdAt: new Date(),
          });
        }

        if (changed && reversed > 0) {
          user.payoutStatus.totalEarned = Math.max(
            0,
            Number(user.payoutStatus.totalEarned || 0) - reversed
          );
          user.payoutStatus.currentBalance = Math.max(
            0,
            Number(user.payoutStatus.currentBalance || 0) - reversed
          );
          await user.save();

          // Ledger debit (enum-safe)
          try {
            await Ledger.create({
              accountType: 'user',
              accountId: user._id,
              sourceType: 'booking',
              sourceModel: 'Booking',
              sourceId: booking._id,
              bookingId: booking._id,
              direction: 'debit',
              amount: reversed,
              reason: 'adjustment',
              status: 'pending',
              currency: 'NGN',
              meta: { category: 'event_center', kind: 'user_cashback_reversal' },
              createdAt: new Date(),
            });
          } catch (_) { /* optional */ }
        }
      }
    } catch (e) {
      console.warn('⚠️ [eventcenter/cancel] Cashback reversal failed softly:', e.message);
    }

    /* ────────────────────────────────────────────────────────────
       ✅ Reverse any referrer commission (user doc + ledger)
       Mirrors hotels: source === 'booking' with sourceId = booking._id
       ──────────────────────────────────────────────────────────── */
    try {
      const refCredits = await Ledger.find({
        reason: 'user_referral_commission',
        bookingId: booking._id,
        accountType: 'user',
        direction: 'credit',
      }).lean();

      const handledReferrers = new Set();
      const processReverseForUser = async (refUser, amountFromLedger = 0) => {
        if (!refUser || handledReferrers.has(String(refUser._id))) return;
        handledReferrers.add(String(refUser._id));

        refUser.earnings = Array.isArray(refUser.earnings)
          ? refUser.earnings
          : (refUser.earnings ? [refUser.earnings] : []);
        refUser.payoutStatus = refUser.payoutStatus || {};

        let reversedCommission = 0;
        let changed = false;

        refUser.earnings.forEach((e) => {
          const sid = String(e?.sourceId || '');
          const src = String(e?.source || '').toLowerCase();
          if (sid === String(booking._id) && e?.status !== 'reversed' && src === 'booking') {
            reversedCommission += Number(e?.amount || 0);
            e.status = 'reversed';
            e.reversalReason = 'booking_cancelled';
            e.reversalDate = new Date();
            changed = true;
          }
        });

        const finalCommission = reversedCommission || Number(amountFromLedger || 0);

        const hasNeg = refUser.earnings.some(
          (e) =>
            String(e?.sourceId || '') === String(booking._id) &&
            String(e?.source || '') === 'referral_reversal'
        );
        if ((changed || finalCommission > 0) && !hasNeg && finalCommission > 0) {
          refUser.earnings.push({
            amount: -finalCommission,
            source: 'referral_reversal',
            sourceId: booking._id,
            status: 'posted',
            createdAt: new Date(),
          });
        }

        if ((changed || finalCommission > 0) && finalCommission > 0) {
          refUser.payoutStatus.totalEarned = Math.max(
            0,
            Number(refUser.payoutStatus.totalEarned || 0) - finalCommission
          );
          refUser.payoutStatus.currentBalance = Math.max(
            0,
            Number(refUser.payoutStatus.currentBalance || 0) - finalCommission
          );
          await refUser.save();

          // Ledger debit (enum-safe)
          try {
            await Ledger.create({
              accountType: 'user',
              accountId: refUser._id,
              sourceType: 'booking',
              sourceModel: 'Booking',
              sourceId: booking._id,
              bookingId: booking._id,
              direction: 'debit',
              amount: finalCommission,
              reason: 'adjustment',
              status: 'pending',
              currency: 'NGN',
              meta: { category: 'event_center', kind: 'user_referral_reversal' },
              createdAt: new Date(),
            });
          } catch (_) { /* optional */ }
        }
      };

      if (Array.isArray(refCredits) && refCredits.length) {
        for (const credit of refCredits) {
          const refUser = await User.findById(credit.accountId).exec();
          await processReverseForUser(refUser, Number(credit.amount || 0));
        }
      } else {
        const refUser = await User.findOne({
          earnings: { $elemMatch: { sourceId: booking._id, source: 'booking' } },
        }).exec();
        await processReverseForUser(refUser, 0);
      }
    } catch (e) {
      console.warn('⚠️ [eventcenter/cancel] Referral commission reversal failed softly:', e.message);
    }

    /* ────────────────────────────────────────────────────────────
       ✅ Reverse vendor share in ledger (as an adjustment) — existing
       ──────────────────────────────────────────────────────────── */
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

    // ✅ Mark canceled
    booking.canceled = true;
    booking.cancellationDate = new Date();
    await booking.save();

    return res.status(200).json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('❌ [eventcenter/cancel] Error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});


module.exports = router;

// âœ… routes/shortletBookingRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

const ShortletBooking = require('../models/shortletBookingModel');
const Shortlet = require('../models/shortletModel');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const rewardReferral = require('../utils/referralReward');

const sendShortletBookingEmails = require('../utils/sendShortletBookingEmails');
const sendShortletCancellationEmails = require('../utils/sendShortletCancellationEmails');
const auth = require('../middleware/auth');

// âœ… Ledger additions
const {
  recordBookingLedger,
  releasePendingForBooking,
} = require('../services/ledgerService');

const Ledger = require('../models/ledgerModel');

// âœ… NEW: pull live percentages (cashback/referral/platform) from DB settings
const configService = require('../services/configService');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ helper: resolve referrer (id or userCode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const looksLikeObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);
const resolveReferrerId = async (referredByUserIdOrCode) => {
  if (!referredByUserIdOrCode) return null;
  return looksLikeObjectId(referredByUserIdOrCode)
    ? (await User.findById(referredByUserIdOrCode).select('_id').lean())?._id || null
    : (await User.findOne({ userCode: referredByUserIdOrCode }).select('_id').lean())?._id || null;
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ verifyPayment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const verifyPayment = async (reference, provider) => {
  try {
    if (provider === 'paystack') {
      const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }
      });
      return response.data?.data?.status === 'success';
    } else if (provider === 'flutterwave') {
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?reference=${reference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      return response.data?.data?.status === 'successful';
    }
    return false;
  } catch (err) {
    console.error('âŒ [shortlet/verified] Payment verification failed:', err.message);
    return false;
  }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ GET /my â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/my', auth, async (req, res) => {
  try {
    const bookings = await ShortletBooking.find({ email: req.user.email })
      .populate('shortlet')
      .sort({ checkIn: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('âŒ [shortlet/my] Error fetching user bookings:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ POST / (legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/', async (req, res) => {
  try {
    const {
      fullName, email, phone, checkIn, checkOut, guests,
      shortletId, price, paymentReference, paymentProvider,
      paymentStatus = 'pending',
    } = req.body;

    if (!fullName || !email || !phone || !checkIn || !checkOut || !guests || !shortletId) {
      return res.status(400).json({ message: 'Missing required booking fields' });
    }

    const shortlet = await Shortlet.findById(shortletId);
    if (!shortlet) return res.status(404).json({ message: 'Invalid shortlet' });

    const newBooking = new ShortletBooking({
      fullName,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      shortlet: shortletId,
      price,
      paymentReference,
      paymentProvider,
      paymentStatus,
    });
    await newBooking.save();

    // Emails (best-effort)
    try {
      await sendShortletBookingEmails({
        userEmail: email,
        vendorEmail: shortlet.vendorEmail || shortlet.email || process.env.FALLBACK_VENDOR_EMAIL,
        adminEmail: process.env.ADMIN_EMAIL,
        shortletName: shortlet.name,
        fullName, phone, checkIn, checkOut, guests,
      });
    } catch (e) {
      console.warn('âš ï¸ [shortlet/create] Failed to send shortlet booking emails:', e.message);
    }

    res.status(201).json({ message: 'Booking saved successfully', booking: newBooking });
  } catch (err) {
    console.error('âŒ [shortlet/create] Booking creation error:', err);
    res.status(500).json({ message: 'Booking failed' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ POST /verified â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/verified', async (req, res) => {
  try {
    console.log('âž¡ï¸ [shortlet/verified] Booking Request Received');
    console.log('â¬…ï¸ [shortlet/verified] keys:', Object.keys(req.body));

    const {
      fullName,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      shortletId,
      price,
      paymentReference,
      paymentProvider,
      referredByUserId,       // id or userCode (we'll resolve)
      buyerUserId: buyerUserIdFromBody, // optional
    } = req.body;

    if (!fullName || !email || !phone || !checkIn || !checkOut || !guests || !shortletId || !price) {
      console.log('â›” [shortlet/verified] Missing fields:', { fullName, email, phone, checkIn, checkOut, guests, shortletId, price });
      return res.status(400).json({ error: 'Missing required booking fields' });
    }

    const buyerEmailRaw = (email || '').trim();
    const buyerEmail = buyerEmailRaw.toLowerCase();
    console.log('ðŸ§‘ [shortlet/verified] buyer normalized:', buyerEmail);
    console.log('ðŸŽ¯ [shortlet/verified] referredByUserId (payload):', referredByUserId);
    console.log('ðŸ’° [shortlet/verified] Booking Price:', price);

    // 0) Load live config (fractions, e.g. 0.03 for 3%)
    const cfg = await configService.load();
    const pctCash = Number(cfg.cashbackPctHotel ?? 0.03);
    const pctRef  = Number(cfg.referralPctHotel ?? 0.03);
    const pctPlat = Number(cfg.platformPctLodging ?? 0.15);

    // 1) Resolve shortlet & vendor
    const shortlet = await Shortlet.findById(shortletId).lean();
    if (!shortlet) {
      console.log('â›” [shortlet/verified] Shortlet not found for id:', shortletId);
      return res.status(404).json({ error: 'Invalid shortlet' });
    }

    const vendorIdForLedger = shortlet.vendorId ? String(shortlet.vendorId) : null;
    if (!vendorIdForLedger) {
      console.log('â›” [shortlet/verified] Shortlet has no vendorId');
      return res.status(400).json({ error: 'Shortlet vendor not found' });
    }
    console.log('ðŸ§­ [shortlet/verified] vendorIdForLedger resolved as:', vendorIdForLedger);

    // 2) Try to identify the logged-in buyer from Authorization header
    let authUser = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          authUser = await User.findById(decoded.id).exec();
          if (authUser) console.log('ðŸ” [shortlet/verified] Authenticated buyer via token:', authUser.email);
        }
      } catch (e) {
        console.warn('âš ï¸ [shortlet/verified] JWT decode failed or user not found:', e.message);
      }
    }

    // 3) Save booking FIRST
    const newBooking = new ShortletBooking({
      fullName,
      email: buyerEmail,
      phone,
      checkIn,
      checkOut,
      guests,
      shortlet: shortletId,
      price,
      paymentReference,
      paymentProvider,
      paymentStatus: 'paid',
    });
    await newBooking.save();
    console.log('âœ… [shortlet/verified] Booking saved with ID:', newBooking._id);

    // Debug: confirm collection/existence
    console.log('ðŸ“‚ [shortlet/verified] ShortletBooking collection =', ShortletBooking.collection.collectionName);
    console.log('ðŸ—„ï¸  [shortlet/verified] Connected DB name     =', ShortletBooking.db?.name);
    console.log('ðŸ”Ž [shortlet/verified] Post-save exists?      =', !!(await ShortletBooking.exists({ _id: newBooking._id })));

    // 4) Resolve buyer account â†’ prefer token, else body, else email lookup
    let buyerUser = authUser;
    if (!buyerUser && buyerUserIdFromBody) {
      buyerUser = await User.findById(buyerUserIdFromBody).exec();
      if (buyerUser) console.log('ðŸ‘¤ [shortlet/verified] Buyer resolved via body.buyerUserId:', buyerUser.email);
    }
    if (!buyerUser) {
      buyerUser = await User.findOne({ email: buyerEmail }).exec();
      if (buyerUser) console.log('ðŸ‘¤ [shortlet/verified] Buyer resolved via email lookup:', buyerUser.email);
    }

    const buyerAccountEmail = (buyerUser?.email || buyerEmail).toLowerCase();

    // 5) Count user's paid shortlet bookings
    const buyerPaidCount = await ShortletBooking.countDocuments({
      email: buyerAccountEmail,
      paymentStatus: 'paid',
      canceled: { $ne: true },
    });
    console.log('ðŸ§® [shortlet/verified] buyerPaidCount:', buyerPaidCount);

    // For logs only (accurate now)
    console.log(
      `ðŸ [shortlet/verified] cashback %=${(pctCash*100).toFixed(2)} | referral %=${(pctRef*100).toFixed(2)} | platform(lodging) %=${(pctPlat*100).toFixed(2)}`
    );

    // 6) Resolve referrer id (id or userCode)
    let resolvedReferrerId = null;
    if (referredByUserId) {
      resolvedReferrerId = await resolveReferrerId(referredByUserId);
      console.log('ðŸ”— [shortlet/verified] resolvedReferrerId =', resolvedReferrerId ? String(resolvedReferrerId) : null);
    }

    // ðŸ” Decide if THIS booking qualifies as a referral (vs cashback)
    const isSelfReferral =
      !!resolvedReferrerId && !!buyerUser &&
      String(resolvedReferrerId) === String(buyerUser._id);

    // Minimal rule: referral applies if link present, not self, and this is FIRST paid booking
    const isFirstPaid = buyerPaidCount === 1;
    const isReferralForThisBooking = !!resolvedReferrerId && !isSelfReferral && isFirstPaid;

    // 7) Referrer commission â€” only if truly eligible for THIS booking
    if (isReferralForThisBooking) {
      // NOTE: rewardReferral uses its own logic; ledger will still reflect the correct % via recordBookingLedger
      console.log(`ðŸ‘‰ [shortlet/verified] referral eligible â€” calling rewardReferral at ${(pctRef*100).toFixed(2)}% of price`);
      await rewardReferral({
        buyerEmail: buyerAccountEmail,
        bookingId: newBooking._id,
        price: Number(price),
        referrerId: resolvedReferrerId,
      });
    } else if (resolvedReferrerId) {
      console.log('â›” Skipping commission: not eligible for referral on this booking.');
    }

    // 8) Cashback â€” only if NOT a referral for this booking and buyer has an account
    let actuallyCreditedCashback = false;
    const cashbackEligibleNow = !!buyerUser && !isReferralForThisBooking;

    console.log('ðŸ” [shortlet/verified] cashback gating:', {
      cashbackEligibleNow,
      buyerId: buyerUser ? String(buyerUser._id) : null,
    });

    if (cashbackEligibleNow) {
      const cashbackAmount = Math.round(Number(price) * pctCash); // â† use live % (no 5% hardcode)
      buyerUser.earnings = buyerUser.earnings || {};
      buyerUser.earnings = Array.isArray(buyerUser.earnings) ? buyerUser.earnings : [];
      buyerUser.payoutStatus = buyerUser.payoutStatus || {};

      buyerUser.earnings.push({
        amount: cashbackAmount,
        source: 'transaction', // cashback
        sourceId: newBooking._id,
        status: 'pending',
      });
      buyerUser.payoutStatus.totalEarned = (buyerUser.payoutStatus.totalEarned || 0) + cashbackAmount;
      buyerUser.payoutStatus.currentBalance = (buyerUser.payoutStatus.currentBalance || 0) + cashbackAmount;
      await buyerUser.save();
      actuallyCreditedCashback = true;
      console.log(`ðŸ’µ [shortlet/verified] Cashback credited: â‚¦${cashbackAmount} @ ${(pctCash*100).toFixed(2)}%`);
    } else if (buyerUser) {
      console.log('ðŸš« [shortlet/verified] No cashback: referral applies for this booking.');
    } else {
      console.log('â„¹ï¸ [shortlet/verified] Guest booking â€” no cashback (no buyer account identified).');
      console.log('   Tip: FE can send Authorization token and/or buyerUserId.');
    }

    // 9) Vendor payout (best-effort; mirror hotel) â€” compute from live platform %
    try {
      const vendorShare = Math.round(Number(price) * (1 - pctPlat)); // no hardcoded 85%
      const vendor = await Vendor.findById(vendorIdForLedger).exec();
      if (vendor) {
        vendor.payoutHistory = vendor.payoutHistory || [];
        vendor.payoutHistory.push({
          amount: vendorShare,
          account: {},
          status: 'pending',
          date: new Date(),
          category: 'shortlet',
          bookingId: newBooking._id,
        });
        await vendor.save();
        console.log(
          `ðŸ¦ [shortlet/verified] Vendor credited (pending) ${vendor.email} +â‚¦${vendorShare} (platform=${(pctPlat*100).toFixed(2)}%)`
        );
      } else {
        console.warn('âš ï¸ [shortlet/verified] Vendor not found in Vendor collection for id:', String(vendorIdForLedger));
      }
    } catch (e) {
      console.warn('âš ï¸ [shortlet/verified] Vendor payout failed:', e.message);
    }

    // 10) Ledger â€” reflect the same classification
    try {
      const args = {
        _id: newBooking._id,
        userId: buyerUser ? buyerUser._id : null,
        vendorId: vendorIdForLedger,
        totalCost: Number(price),
        checkInDate: checkIn ? new Date(checkIn) : null,
        checkOutDate: checkOut ? new Date(checkOut) : null,
        cashbackEligible: !!actuallyCreditedCashback,
        referralUserId: isReferralForThisBooking ? resolvedReferrerId : null,
        type: 'shortlet',
      };
      console.log('ðŸ“ [shortlet/verified] recordBookingLedger args:', {
        bookingId: String(args._id),
        userId: args.userId ? String(args.userId) : null,
        vendorId: String(args.vendorId),
        totalCost: args.totalCost,
        checkIn,
        checkOut,
        cashbackEligible: args.cashbackEligible,
        referralUserId: args.referralUserId ? String(args.referralUserId) : null,
      });

      await recordBookingLedger(args, { category: 'shortlet' });
      console.log('ðŸ§¾ [shortlet/verified] Ledger rows recorded for booking:', String(newBooking._id));

      const cnt = await Ledger.countDocuments({ bookingId: newBooking._id });
      console.log('ðŸ“˜ [shortlet/verified] Ledger collection =', Ledger.collection.collectionName, '| have rows =', cnt > 0, '| count =', cnt);
    } catch (e) {
      console.error('âš ï¸ [shortlet/verified] recordBookingLedger failed (booking continues):', e.message);
    }

    // 11) Emails (best-effort)
    try {
      await sendShortletBookingEmails({
        userEmail: buyerEmail,
        vendorEmail: shortlet.vendorEmail || shortlet.email || process.env.FALLBACK_VENDOR_EMAIL,
        adminEmail: process.env.ADMIN_EMAIL,
        shortletName: shortlet.name || shortlet.title || 'Shortlet',
        fullName, phone, checkIn, checkOut, guests,
      });
      console.log('âœ… Shortlet booking confirmation emails sent.');
    } catch (e) {
      console.warn('âš ï¸ [shortlet/verified] Failed to send shortlet booking emails:', e.message);
    }

    return res.status(201).json({ message: 'âœ… Booking saved successfully' });
  } catch (err) {
    console.error('âŒ [shortlet/verified] Booking error:', err);
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }
});

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ CANCEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.patch('/:id/cancel', async (req, res) => {
  try {
    // Resolve caller email: prefer JWT, else body
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
    } catch { /* ignore */ }

    const emailFromBody = String(req.body?.email || '').trim().toLowerCase();
    const candidateEmail = authEmail || emailFromBody;

    if (!candidateEmail) {
      return res.status(400).json({ message: 'Email is required or sign in to cancel.' });
    }

    const booking = await ShortletBooking.findById(req.params.id).populate('shortlet').exec();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.canceled) return res.status(400).json({ message: 'Booking already canceled' });

    const now = new Date();
    if (new Date(booking.checkIn) <= now) {
      return res.status(400).json({ message: 'Cannot cancel after check-in date' });
    }

    // âœ… Reverse buyer cashback (earnings + ledger adjustment)
    try {
      const buyer = await User.findOne({ email: candidateEmail }).exec();
      if (buyer) {
        buyer.earnings = Array.isArray(buyer.earnings) ? buyer.earnings : (buyer.earnings ? [buyer.earnings] : []);
        buyer.payoutStatus = buyer.payoutStatus || {};

        let reversed = 0;
        let changed = false;

        buyer.earnings.forEach((e) => {
          const sid = String(e?.sourceId || '');
          const src = String(e?.source || '').toLowerCase();
          if (sid === String(booking._id) && e?.status !== 'reversed' && src.includes('transaction')) {
            reversed += Number(e?.amount || 0);
            e.status = 'reversed';
            e.reversalReason = 'booking_cancelled';
            e.reversalDate = new Date();
            changed = true;
          }
        });

        const hasNeg = buyer.earnings.some(
          (e) => String(e?.sourceId || '') === String(booking._id) && String(e?.source || '') === 'transaction_reversal'
        );
        if (changed && reversed > 0 && !hasNeg) {
          buyer.earnings.push({
            amount: -reversed,
            source: 'transaction_reversal',
            sourceId: booking._id,
            status: 'posted',
            createdAt: new Date(),
          });
        }

        if (changed && reversed > 0) {
          buyer.payoutStatus.totalEarned = Math.max(0, Number(buyer.payoutStatus.totalEarned || 0) - reversed);
          buyer.payoutStatus.currentBalance = Math.max(0, Number(buyer.payoutStatus.currentBalance || 0) - reversed);
          await buyer.save();

          // âœ… Ledger debit (enum-safe)
          try {
            await Ledger.create({
              accountType: 'user',
              accountId: buyer._id,
              sourceType: 'booking',
              sourceModel: 'Booking',
              sourceId: booking._id,
              bookingId: booking._id,
              direction: 'debit',
              amount: reversed,
              reason: 'adjustment',
              status: 'pending',
              currency: 'NGN',
              meta: { category: 'shortlet', kind: 'user_cashback_reversal' },
            });
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('âš ï¸ [shortlet/cancel] Cashback reversal failed softly:', e.message);
    }

    // âœ… Reverse any referrer commission (earnings + ledger)
    try {
      let refUser = null;
      let refAmountFromLedger = 0;

      // Prefer Ledger
      const refCredit = await Ledger.findOne({
        reason: 'user_referral_commission',
        bookingId: booking._id,
        accountType: 'user',
        direction: 'credit',
      }).lean();

      if (refCredit?.accountId) {
        refUser = await User.findById(refCredit.accountId).exec();
        if (refUser) refAmountFromLedger = Number(refCredit.amount || 0);
      } else {
        refUser = await User.findOne({
          earnings: { $elemMatch: { sourceId: booking._id } },
        }).exec();
      }

      if (refUser) {
        refUser.earnings = Array.isArray(refUser.earnings) ? refUser.earnings : (refUser.earnings ? [refUser.earnings] : []);
        refUser.payoutStatus = refUser.payoutStatus || {};

        let reversedCommission = 0;
        let changed = false;

        refUser.earnings.forEach((e) => {
          const sid = String(e?.sourceId || '');
          const src = String(e?.source || '').toLowerCase();
          if (
            sid === String(booking._id) &&
            e?.status !== 'reversed' &&
            (src.includes('referral') || src.includes('commission') || src === 'booking')
          ) {
            reversedCommission += Number(e?.amount || 0);
            e.status = 'reversed';
            e.reversalReason = 'booking_cancelled';
            e.reversalDate = new Date();
            changed = true;
          }
        });

        const hasNeg = refUser.earnings.some(
          (e) => String(e?.sourceId || '') === String(booking._id) && String(e?.source || '') === 'referral_reversal'
        );
        const finalCommission = reversedCommission || refAmountFromLedger;

        if ((changed || finalCommission > 0) && finalCommission > 0 && !hasNeg) {
          refUser.earnings.push({
            amount: -finalCommission,
            source: 'referral_reversal',
            sourceId: booking._id,
            status: 'posted',
            createdAt: new Date(),
          });
        }

        if ((changed || finalCommission > 0) && finalCommission > 0) {
          refUser.payoutStatus.totalEarned = Math.max(0, Number(refUser.payoutStatus.totalEarned || 0) - finalCommission);
          refUser.payoutStatus.currentBalance = Math.max(0, Number(refUser.payoutStatus.currentBalance || 0) - finalCommission);
          await refUser.save();

          // âœ… Ledger debit (enum-safe)
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
              meta: { category: 'shortlet', kind: 'user_referral_reversal' },
            });
          } catch (_) {}
        }
      }
    } catch (e) {
      console.warn('âš ï¸ [shortlet/cancel] Referral commission reversal failed softly:', e.message);
    }

    // âœ… Cancel booking (fix: reuse existing `booking`, no second `const now`)
    booking.canceled = true;
    booking.cancellationDate = new Date();
    await booking.save();

    // Emails (best-effort)
    try {
      await sendShortletCancellationEmails({
        userEmail: booking.email,
        vendorEmail: booking.shortlet?.vendorEmail || process.env.FALLBACK_VENDOR_EMAIL,
        adminEmail: process.env.ADMIN_EMAIL,
        shortletName: booking.shortlet?.name || booking.shortlet?.title,
        fullName: booking.fullName,
        phone: booking.phone,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
      });
    } catch (e) {
      console.warn('âš ï¸ [shortlet/cancel] Failed to send cancellation emails:', e.message);
    }

    return res.status(200).json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('âŒ [shortlet/cancel] Cancel Booking Error:', err);
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

// Mark check-in (soft)
router.post('/:id/check-in', auth, async (req, res) => {
  const b = await ShortletBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_in';
    b.checkInDate = b.checkInDate || new Date();
    await b.save();
  } catch (_) { /* ignore if schema is strict */ }

  res.json({ ok: true });
});

// Mark check-out and release pending â†’ available
router.post('/:id/check-out', auth, async (req, res) => {
  const b = await ShortletBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_out';
    b.checkOutDate = b.checkOutDate || new Date();
    await b.save();
  } catch (_) { /* ignore */ }

  const released = await releasePendingForBooking(b._id);
  res.json({ ok: true, released });
});

module.exports = router;


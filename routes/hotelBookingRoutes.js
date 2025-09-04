// ✅ routes/hotelBookingRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

const HotelBooking = require('../models/hotelBookingModel');
const Room = require('../models/roomModel');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');          // payouts list (legacy bucket you already use)
const Ledger = require('../models/ledgerModel');          // reversals use this too
const rewardReferral = require('../utils/referralReward'); // your commission logic (unchanged)

// ✅ Ledger writer
const { recordBookingLedger } = require('../services/ledgerService');

// 📧 EMAIL: booking confirmation util (existing file you shared)
const sendBookingEmails = require('../utils/sendBookingEmails');

// ✅ NEW: load admin-configured percents (fractions)
const configService = require('../services/configService');

const pctOf = (amount, frac) => Math.round(Number(amount) * Number(frac || 0));
const asPctText = (frac) => `${(Number(frac || 0) * 100).toFixed(2)}%`;

/**
 * POST /api/bookings/hotel/verified
 * - Saves the booking
 * - Runs your existing commission & cashback logic (unchanged)
 * - Writes Ledger rows that mirror what actually happened
 */
router.post('/verified', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      pickup,
      pickupLocation,
      hotelId,
      roomId,                 // legacy single-room
      rooms,                  // optional multi-room: [{ roomId, qty? }]
      price,
      paymentReference,
      paymentProvider,
      referredByUserId,       // optional
      buyerUserId: buyerUserIdFromBody, // optional (FE may pass it)
    } = req.body;

    console.log('➡️ [hotel/verified] Booking Request Received');
    console.log('⬅️ [hotel/verified] keys:', Object.keys(req.body));
    const buyerEmailRaw = (email || '').trim();
    const buyerEmail = buyerEmailRaw.toLowerCase();
    console.log('🧑 [hotel/verified] buyer normalized:', buyerEmail);
    console.log('🎯 [hotel/verified] referredByUserId (payload):', referredByUserId);
    console.log('💰 [hotel/verified] Booking Price:', price);
    if (Array.isArray(rooms)) console.log('🧩 [hotel/verified] rooms payload:', rooms);

    // 🔧 Load admin “knobs” (fractions)
    const cfg = await configService.load();
    const cashbackPct = Number(cfg.cashbackPctHotel ?? 0);        // e.g. 0.03
    const referralPct = Number(cfg.referralPctHotel ?? 0);        // e.g. 0.03
    const platformPct = Number(cfg.platformPctLodging ?? 0.15);   // e.g. 0.15

    // 0) Try to identify the logged-in buyer from Authorization header
    let authUser = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          authUser = await User.findById(decoded.id).exec();
          if (authUser) console.log('🔐 [hotel/verified] Authenticated buyer via token:', authUser.email);
        }
      } catch (e) {
        console.warn('⚠️ [hotel/verified] JWT decode failed or user not found:', e.message);
      }
    }

    // ✅ Resolve vendor from rooms (multi) or roomId (legacy)
    let vendorIdForLedger = null;
    let effectiveRoomId = roomId || null;

    if (Array.isArray(rooms) && rooms.length > 0) {
      const roomIds = rooms.map(r => r.roomId).filter(Boolean);
      if (roomIds.length === 0) {
        return res.status(400).json({ error: 'rooms[].roomId is required' });
      }

      const roomDocs = await Room.find({ _id: { $in: roomIds } })
        .select('vendorId name price hotelId')
        .lean();

      if (roomDocs.length !== roomIds.length) {
        return res.status(400).json({ error: 'One or more rooms not found' });
      }

      console.log('📄 [hotel/verified] loaded room docs (subset):', roomDocs.map(r => ({
        _id: r._id, name: r.name, price: r.price, hotelId: r.hotelId, vendorId: r.vendorId,
      })));

      const uniqueVendors = [...new Set(roomDocs.map(r => String(r.vendorId || '')))].filter(Boolean);
      console.log('🔎 [hotel/verified] uniqueVendors from rooms:', uniqueVendors);

      if (uniqueVendors.length !== 1) {
        return res.status(400).json({ error: 'All selected rooms must belong to the same vendor/hotel' });
      }

      vendorIdForLedger = uniqueVendors[0];
      effectiveRoomId = effectiveRoomId || roomIds[0];
      console.log('🧩 [hotel/verified] Multi-room OK:', {
        count: rooms.length,
        vendorIdForLedger,
        effectiveRoomId,
      });
    } else if (roomId) {
      try {
        // 📧 EMAIL: also select name so we can include it in the email later
        const r = await Room.findById(roomId).select('vendorId name').lean();
        if (r?.vendorId) vendorIdForLedger = String(r.vendorId);
      } catch {}
    }
    console.log('🧭 [hotel/verified] vendorIdForLedger resolved as:', vendorIdForLedger);

    // 1) Save booking
    const newBooking = new HotelBooking({
      fullName,
      email: buyerEmail,
      phone,
      checkIn,
      checkOut,
      guests,
      pickup,
      pickupLocation,
      hotel: hotelId,
      room: effectiveRoomId, // keep schema compatibility
      price,
      paymentReference,
      paymentProvider,
      paymentStatus: 'paid',
    });
    await newBooking.save();
    console.log('✅ [hotel/verified] Booking saved with ID:', newBooking._id);

    // 📧 EMAIL: Booking confirmation (user + BCC vendor/admin)
    try {
      // vendor email (optional BCC)
      let vendorEmail = null;
      if (vendorIdForLedger) {
        try {
          const v = await Vendor.findById(vendorIdForLedger).select('email').lean();
          vendorEmail = v?.email || null;
        } catch {}
      }

      // room name (nice to have in the email)
      let roomNameForEmail = '';
      try {
        const rdoc = await Room.findById(effectiveRoomId).select('name').lean();
        roomNameForEmail = rdoc?.name || '';
      } catch {}

      const adminEmail = process.env.ADMIN_EMAIL || process.env.GMAIL_USER;
      const hotelNameForEmail = 'Hotel'; // lightweight label to keep subject clean

      await sendBookingEmails({
        userEmail: buyerEmail,
        vendorEmail,
        adminEmail,
        hotelName: hotelNameForEmail,
        roomName: roomNameForEmail,
        fullName,
        phone,
        checkIn,
        checkOut,
        guests,
      });
    } catch (e) {
      console.warn('⚠️ [hotel/verified] sendBookingEmails failed:', e.message);
    }
    // 📧 EMAIL: end

    // quick sanity log
    try {
      const col = HotelBooking.collection.collectionName;
      const dbName = HotelBooking.db?.databaseName || HotelBooking.collection?.conn?.name;
      const exists = await HotelBooking.exists({ _id: newBooking._id });
      console.log('📂 [hotel/verified] HotelBooking collection =', col);
      console.log('🗄️  [hotel/verified] Connected DB name     =', dbName);
      console.log('🔎 [hotel/verified] Post-save exists?      =', !!exists);
    } catch {}

    // 2) Resolve buyer account → prefer token, else body, else email lookup
    let buyerUser = authUser;
    if (!buyerUser && buyerUserIdFromBody) {
      buyerUser = await User.findById(buyerUserIdFromBody).exec();
      if (buyerUser) console.log('👤 [hotel/verified] Buyer resolved via body.buyerUserId:', buyerUser.email);
    }
    if (!buyerUser) {
      buyerUser = await User.findOne({ email: buyerEmail }).exec();
      if (buyerUser) console.log('👤 [hotel/verified] Buyer resolved via email lookup:', buyerUser.email);
    }

    const buyerAccountEmail = (buyerUser?.email || buyerEmail).toLowerCase();

    // 3) Count user's paid bookings
    const buyerPaidCount = await HotelBooking.countDocuments({
      email: buyerAccountEmail,
      paymentStatus: 'paid',
      canceled: { $ne: true },
    });
    console.log('🧮 [hotel/verified] buyerPaidCount:', buyerPaidCount);

    // ✅ Use admin cashback % for reward
    const reward = pctOf(price, cashbackPct);
    console.log(`🏁 [hotel/verified] cashback/commission reward (${asPctText(cashbackPct)} of price):`, reward);

    // 4) Run your commission logic (UNCHANGED)
    if (referredByUserId) {
      console.log('👉 [hotel/verified] calling rewardReferral with:', {
        buyerEmail: buyerAccountEmail,
        bookingId: String(newBooking._id),
        price: Number(price),
        referrerId: referredByUserId,
      });
      await rewardReferral({
        buyerEmail: buyerAccountEmail,
        bookingId: newBooking._id,
        price: Number(price),
        referrerId: referredByUserId,
      });
    }

    // After rewardReferral, detect if commission actually posted
    let commissionPaid = false;
    let commissionRefUserId = null;
    let commissionAmount = 0;
    if (referredByUserId) {
      try {
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
            commissionAmount = Number(hit.amount || 0);
          }
        }
      } catch (e) {
        console.warn('⚠️ [hotel/verified] Could not inspect referrer earnings:', e.message);
      }
    }
    console.log('🏷️ [hotel/verified] commissionPosted?', { commissionPaid, commissionRefUserId, commissionAmount });

    // 5) Cashback (UNCHANGED except % already aligned above)
    let cashbackApplied = false;
    if (buyerUser) {
      const referredById = buyerUser.referredBy ? String(buyerUser.referredBy) : null;
      const isFirstBookingAndReferred =
        buyerPaidCount === 1 && !!referredById && referredById !== String(buyerUser._id);

      console.log('🔁 [hotel/verified] cashback gating:', {
        isFirstBookingAndReferred,
        referredById,
        buyerId: String(buyerUser._id),
      });

      if (!isFirstBookingAndReferred) {
        // your existing push into earnings + balance math
        buyerUser.earnings = buyerUser.earnings || {};
        buyerUser.earnings = Array.isArray(buyerUser.earnings) ? buyerUser.earnings : [];
        buyerUser.payoutStatus = buyerUser.payoutStatus || {};

        buyerUser.earnings.push({
          amount: reward,
          source: 'transaction', // cashback
          sourceId: newBooking._id,
          status: 'pending',
        });
        buyerUser.payoutStatus.totalEarned = (buyerUser.payoutStatus.totalEarned || 0) + reward;
        buyerUser.payoutStatus.currentBalance = (buyerUser.payoutStatus.currentBalance || 0) + reward;
        await buyerUser.save();
        cashbackApplied = true;
        console.log(`💵 [hotel/verified] Cashback credited to: ${buyerUser.email} amount: ${reward}`);
      } else {
        console.log('🚫 [hotel/verified] No cashback: first booking and user was referred by another user.');
      }
    } else {
      console.log('ℹ️ [hotel/verified] Guest booking — no cashback (no buyer account identified).');
      console.log('   Tip: ensure FE sends Authorization: Bearer <token> and/or buyerUserId.');
    }

    // 6) Vendor payout placeholder (legacy list) — platform covers incentives
try {
  if (vendorIdForLedger) {
    const vendor = await Vendor.findById(vendorIdForLedger).exec();
    if (vendor) {
      // ✅ Vendor share = 1 − platformPct  (do NOT subtract cashback/referral)
      let vendorSharePct = 1 - platformPct;
      if (!Number.isFinite(vendorSharePct)) vendorSharePct = 0;
      if (vendorSharePct < 0) vendorSharePct = 0;

      const vendorShare = pctOf(price, vendorSharePct);

      vendor.payoutHistory = vendor.payoutHistory || [];
      vendor.payoutHistory.push({
        amount: vendorShare,
        account: {},
        status: 'pending',
        date: new Date(),
      });
      await vendor.save();

      console.log(
        `🏦 [hotel/verified] Vendor credited (pending) ${vendor.email} +${vendorShare} ` +
        `(vendorSharePct=${asPctText(vendorSharePct)}, platformPct=${asPctText(platformPct)}, note="platform covers incentives")`
      );
    } else {
      console.warn('⚠️ [hotel/verified] Vendor not found for id:', String(vendorIdForLedger));
    }
  } else {
    console.warn('⚠️ [hotel/verified] No vendorId resolved; vendor payout skipped.');
  }
} catch (e) {
  console.warn('⚠️ [hotel/verified] Vendor payout failed:', e.message);
}


    // 7) LEDGER — mirror *exactly* what really happened
    try {
      const ledgerCashbackEligible = cashbackApplied;               // only if we actually posted cashback
      const ledgerReferralUserId   = commissionPaid ? commissionRefUserId : null; // only if commission actually posted

      console.log('📝 [hotel/verified] recordBookingLedger args:', {
        bookingId: String(newBooking._id),
        userId: buyerUser ? String(buyerUser._id) : null,
        vendorId: vendorIdForLedger ? String(vendorIdForLedger) : null,
        totalCost: Number(price),
        checkIn,
        checkOut,
        cashbackEligible: ledgerCashbackEligible,
        referralUserId: ledgerReferralUserId ? String(ledgerReferralUserId) : null,
      });

      await recordBookingLedger({
        _id: newBooking._id,
        userId: buyerUser ? buyerUser._id : null,
        vendorId: vendorIdForLedger || null,
        totalCost: Number(price),
        checkInDate: checkIn ? new Date(checkIn) : null,
        checkOutDate: checkOut ? new Date(checkOut) : null,
        cashbackEligible: ledgerCashbackEligible,
        referralUserId: ledgerReferralUserId, // NOTE: requires REFERRAL_PCT_LODGING>0 to create a user row
        type: 'hotel',
      });
      console.log('🧾 [hotel/verified] Ledger rows recorded for booking:', String(newBooking._id));

      try {
        const col = Ledger.collection.collectionName;
        const c = await Ledger.countDocuments({ bookingId: newBooking._id });
        console.log('📘 [hotel/verified] Ledger collection =', col, '| have rows =', c > 0, '| count =', c);
      } catch {}
    } catch (e) {
      console.error('⚠️ [hotel/verified] recordBookingLedger failed (booking continues):', e.message);
    }

    return res.status(201).json({ message: '✅ Booking saved successfully' });
  } catch (err) {
    console.error('❌ [hotel/verified] Booking error:', err);
    return res.status(500).json({ error: 'Booking failed. Please try again.' });
  }
});

/**
 * PATCH /api/bookings/hotel/:id/cancel
 * - Reverses cashback & commission in your user doc (unchanged)
 * - Posts compensating negative “adjustment” rows in Ledger for visibility
 * - Also posts vendor reversal in Ledger
 */
router.patch('/:id/cancel', async (req, res) => {
  try {
    // Resolve caller email (prefer JWT)
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
      return res.status(400).json({ message: 'Email is required or sign in to cancel.' });
    }

    const booking = await HotelBooking.findById(req.params.id).exec();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.canceled) return res.status(400).json({ message: 'Booking already canceled' });

    const now = new Date();
    if (new Date(booking.checkIn) <= now) {
      return res.status(400).json({ message: 'Cannot cancel after check-in date' });
    }

    if (String(booking.email || '').toLowerCase() !== candidateEmail) {
      return res.status(403).json({ message: 'Email does not match booking owner' });
    }

    // ✅ Reverse buyer cashback (user doc + ledger adjustment)
    try {
      const user = await User.findOne({ email: candidateEmail }).exec();
      if (user) {
        user.earnings = Array.isArray(user.earnings) ? user.earnings : (user.earnings ? [user.earnings] : []);
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
          (e) => String(e?.sourceId || '') === String(booking._id) && String(e?.source || '') === 'transaction_reversal'
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
          user.payoutStatus.totalEarned = Math.max(0, Number(user.payoutStatus.totalEarned || 0) - reversed);
          user.payoutStatus.currentBalance = Math.max(0, Number(user.payoutStatus.currentBalance || 0) - reversed);
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
              meta: { category: 'hotel', kind: 'user_cashback_reversal' },
              createdAt: new Date(),
            });
          } catch (_) { /* optional */ }
        }
      }
    } catch (e) {
      console.warn('⚠️ [hotel/cancel] Cashback reversal failed softly:', e.message);
    }

    // ✅ Reverse any referrer commission (user doc + ledger)
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

        refUser.earnings = Array.isArray(refUser.earnings) ? refUser.earnings : (refUser.earnings ? [refUser.earnings] : []);
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
          (e) => String(e?.sourceId || '') === String(booking._id) && String(e?.source || '') === 'referral_reversal'
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
          refUser.payoutStatus.totalEarned = Math.max(0, Number(refUser.payoutStatus.totalEarned || 0) - finalCommission);
          refUser.payoutStatus.currentBalance = Math.max(0, Number(refUser.payoutStatus.currentBalance || 0) - finalCommission);
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
              meta: { category: 'hotel', kind: 'user_referral_reversal' },
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
      console.warn('⚠️ [hotel/cancel] Referral commission reversal failed softly:', e.message);
    }

    // ✅ Reverse vendor share in ledger (as an adjustment)
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
                meta: { category: 'hotel', kind: 'vendor_share_reversal' },
              });
            }
          }
          if (toCreate.length) await Ledger.insertMany(toCreate);
        }
      }
    } catch (e) {
      console.warn('⚠️ [hotel/cancel] Vendor reversal posting failed (soft):', e.message);
    }

    // ✅ Mark canceled
    booking.canceled = true;
    booking.cancellationDate = new Date();
    await booking.save();

    return res.status(200).json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('❌ [hotel/cancel] Hotel cancel error:', err);
    return res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

module.exports = router;

// scripts/backfill-cancel-reversals.js
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const HotelBooking = require('../models/hotelBookingModel');
const ShortletBooking = require('../models/shortletBookingModel');

async function connect() {
  const uri = process.env.MONGO_URL || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hotelpennies';
  await mongoose.connect(uri, { autoIndex: false });
  console.log('✅ Connected to Mongo');
}

async function reverseVendorShareForBooking(bookingId) {
  const credits = await Ledger.find({
    bookingId,
    accountType: 'vendor',
    direction: 'credit',
    reason: 'vendor_share',
  }).lean();

  let created = 0;
  for (const c of credits) {
    const exists = await Ledger.exists({
      bookingId,
      accountType: 'vendor',
      accountId: c.accountId,
      direction: 'debit',
      reason: 'vendor_share',
    });
    if (exists) continue;

    await Ledger.create({
      accountType: 'vendor',
      accountId: c.accountId,
      sourceType: 'booking',
      sourceModel: 'Booking',
      sourceId: c.sourceId,
      bookingId: c.bookingId,
      direction: 'debit',
      amount: c.amount,
      currency: c.currency || 'NGN',
      status: c.status || 'pending',
      releaseOn: c.releaseOn || null,
      reason: 'vendor_share',
      meta: { reversal: true, backfill: true },
    });
    created++;
  }
  return created;
}

async function backfillUserCashback(booking) {
  // buyer by booking.email
  const buyer = await User.findOne({ email: String(booking.email || '').toLowerCase() });
  if (!buyer) return { reversed: 0, negAdded: 0 };

  buyer.earnings = Array.isArray(buyer.earnings) ? buyer.earnings : (buyer.earnings ? [buyer.earnings] : []);
  buyer.payoutStatus = buyer.payoutStatus || {};

  let sum = 0, changed = false;
  for (const e of buyer.earnings) {
    const src = String(e.source || '').toLowerCase();
    if (String(e.sourceId || '') === String(booking._id) && src === 'transaction' && e.status !== 'reversed') {
      sum += Number(e.amount || 0);
      e.status = 'reversed';
      e.reversalReason = 'booking_cancelled';
      e.reversalDate = new Date();
      changed = true;
    }
  }

  let negAdded = 0;
  if (changed && sum > 0) {
    const hasNeg = buyer.earnings.some(
      e => String(e.sourceId || '') === String(booking._id) && String(e.source || '') === 'transaction_reversal'
    );
    if (!hasNeg) {
      buyer.earnings.push({
        amount: -sum,
        source: 'transaction_reversal',
        sourceId: booking._id,
        status: 'posted',
        createdAt: new Date(),
      });
      negAdded = 1;
    }
    buyer.payoutStatus.totalEarned = Math.max(0, Number(buyer.payoutStatus.totalEarned || 0) - sum);
    buyer.payoutStatus.currentBalance = Math.max(0, Number(buyer.payoutStatus.currentBalance || 0) - sum);
    await buyer.save();

    // Best-effort ledger mirror using allowed reason 'adjustment'
    await Ledger.create({
      accountType: 'user',
      accountId: buyer._id,
      sourceType: 'booking',
      direction: 'debit',
      amount: sum,
      currency: 'NGN',
      status: 'pending',
      reason: 'adjustment',
      bookingId: booking._id,
      meta: { kind: 'user_cashback_reversal', backfill: true },
    }).catch(() => {});
  }

  return { reversed: changed ? 1 : 0, negAdded };
}

async function backfillReferrerCommission(booking) {
  // locate referrer + amount from Ledger (most reliable)
  const credit = await Ledger.findOne({
    bookingId: booking._id,
    accountType: 'user',
    direction: 'credit',
    reason: 'user_referral_commission',
  }).lean();

  if (!credit || !credit.accountId) return { reversed: 0, negAdded: 0 };
  const refUser = await User.findById(credit.accountId);
  if (!refUser) return { reversed: 0, negAdded: 0 };

  refUser.earnings = Array.isArray(refUser.earnings) ? refUser.earnings : (refUser.earnings ? [refUser.earnings] : []);
  refUser.payoutStatus = refUser.payoutStatus || {};

  let sum = 0, changed = false;
  for (const e of refUser.earnings) {
    const src = String(e.source || '').toLowerCase();
    if (String(e.sourceId || '') === String(booking._id) && (src === 'booking' || src.includes('commission') || src.includes('referral')) && e.status !== 'reversed') {
      sum += Number(e.amount || 0);
      e.status = 'reversed';
      e.reversalReason = 'booking_cancelled';
      e.reversalDate = new Date();
      changed = true;
    }
  }
  // if nothing in earnings, still use the ledger credit amount
  if (!changed && credit.amount) {
    sum = Number(credit.amount || 0);
  }

  let negAdded = 0;
  if (sum > 0) {
    const hasNeg = refUser.earnings.some(
      e => String(e.sourceId || '') === String(booking._id) && String(e.source || '') === 'referral_reversal'
    );
    if (!hasNeg) {
      refUser.earnings.push({
        amount: -sum,
        source: 'referral_reversal',
        sourceId: booking._id,
        status: 'posted',
        createdAt: new Date(),
      });
      negAdded = 1;
    }
    refUser.payoutStatus.totalEarned = Math.max(0, Number(refUser.payoutStatus.totalEarned || 0) - sum);
    refUser.payoutStatus.currentBalance = Math.max(0, Number(refUser.payoutStatus.currentBalance || 0) - sum);
    await refUser.save();

    await Ledger.create({
      accountType: 'user',
      accountId: refUser._id,
      sourceType: 'booking',
      direction: 'debit',
      amount: sum,
      currency: 'NGN',
      status: 'pending',
      reason: 'adjustment',
      bookingId: booking._id,
      meta: { kind: 'user_referral_reversal', backfill: true },
    }).catch(() => {});
  }

  return { reversed: sum > 0 ? 1 : 0, negAdded };
}

async function processCollection(Model, label) {
  const cancelled = await Model.find({ canceled: true }).lean();
  console.log(`\n${label}: found ${cancelled.length} cancelled bookings`);

  let uRev = 0, uNeg = 0, rRev = 0, rNeg = 0, vDeb = 0;

  for (const b of cancelled) {
    const U = await backfillUserCashback(b);
    uRev += U.reversed; uNeg += U.negAdded;

    const R = await backfillReferrerCommission(b);
    rRev += R.reversed; rNeg += R.negAdded;

    vDeb += await reverseVendorShareForBooking(b._id);
  }

  console.log(`${label} summary → buyer reversed: ${uRev} (+neg:${uNeg}), referrer reversed: ${rRev} (+neg:${rNeg}), vendor debits added: ${vDeb}`);
}

(async () => {
  try {
    await connect();
    await processCollection(HotelBooking, 'Hotel');
    await processCollection(ShortletBooking, 'Shortlet');
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Done');
  }
})();

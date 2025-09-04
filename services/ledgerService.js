// services/ledgerService.js
require('dotenv').config();
const mongoose = require('mongoose');
const Ledger = require('../models/ledgerModel');
const Vendor = require('../models/vendorModel');
const config = require('./configService'); // DB + cache-backed settings

// ────────────────────────── Debug helper ──────────────────────────
const LEDGER_DEBUG = String(process.env.LEDGER_DEBUG || '0') === '1';
const dlog = (...a) => { if (LEDGER_DEBUG) console.log(...a); };

// ─────────────────────── Runtime config helpers ────────────────────
// Read from DB knob; if unset, fall back to ENV; else default
// DB stores FRACTIONS (0..1), but split math needs PERCENTS (0..100)
// → if DB value in (0,1], multiply by 100.
function getPct(knobKey, envKey, fallback) {
  const fromDb = config.getNumber(knobKey, undefined);
  if (typeof fromDb === 'number' && !Number.isNaN(fromDb)) {
    return fromDb > 0 && fromDb <= 1 ? fromDb * 100 : fromDb;
  }
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined) return Number(fromEnv);
  return Number(fallback);
}
function getBool(knobKey, envKey, fallback) {
  const fromDb = config.getBoolean ? config.getBoolean(knobKey, undefined, undefined) : config.getBoolean(knobKey, undefined, undefined);
  if (typeof fromDb === 'boolean') return fromDb;
  const fromEnv = process.env[envKey];
  if (fromEnv !== undefined) return String(fromEnv).toLowerCase() === 'true';
  return Boolean(fallback);
}

// “Live” getters (cheap—reads from in-memory cache primed at boot, hot-reloads when Admin updates)
function LIVE_PLATFORM_PCT_LODGING()     { return getPct('platform_pct_lodging',        'PLATFORM_PCT_LODGING', 15); }
function LIVE_CASHBACK_PCT_LODGING()     { return getPct('cashback_pct_lodging',        'CASHBACK_PCT_LODGING', 3); }
function LIVE_REFERRAL_PCT_LODGING()     { return getPct('referral_pct_lodging',        'REFERRAL_PCT_LODGING', 3); }
function LIVE_PLATFORM_PCT_DEFAULT()     { return getPct('platform_pct_default',        'PLATFORM_PCT_DEFAULT', 15); }
function LIVE_MATURES_WITH_VENDOR_FLAG() { return getBool('platform_matures_with_vendor','PLATFORM_MATURES_WITH_VENDOR', false); }

// ───────────────────────── Category helpers ───────────────────────
function normalizeCategory(raw) {
  const s = String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (/(^|\s)(hotel|hotels|shortlet|shortlets)(\s|$)/.test(s)) return 'lodging';
  if (
    /(^|\s)(chop|chops)(\s|$)/.test(s) ||
    /(^|\s)(gift|gifts|gift\s*item|gift\s*items|giftcard|giftcards|gift\s*card|gift\s*cards)(\s|$)/.test(s)
  ) return 'chops_gifts';
  if (/(^|\s)(event|event center|event centre|hall)(\s|$)/.test(s)) return 'event_center';
  if (/(^|\s)(restaurant|food|eatery)(\s|$)/.test(s)) return 'restaurant';
  if (/(^|\s)(tour|tour guide|guide)(\s|$)/.test(s)) return 'tour_guide';
  return 'other';
}

function computeSplit(gross, { splitKind = 'none', category = 'hotel' } = {}) {
  const amt = Math.max(0, Number(gross || 0));
  let vendor = 0, user = 0, admin = 0;

  const cat = normalizeCategory(category);

  if (cat === 'chops_gifts') {
    admin = amt; // platform-only
  } else if (['event_center', 'restaurant', 'tour_guide'].includes(cat)) {
    const platformPct = LIVE_PLATFORM_PCT_DEFAULT();
    const vendorPct   = 100 - platformPct;
    vendor = Math.round((vendorPct / 100) * amt);
    admin  = Math.round((platformPct / 100) * amt);
  } else if (cat === 'lodging') {
    const platformPct = LIVE_PLATFORM_PCT_LODGING();
    const vendorPct   = 100 - platformPct;
    vendor = Math.round((vendorPct / 100) * amt);

    if (splitKind === 'cashback' && LIVE_CASHBACK_PCT_LODGING() > 0) {
      user  = Math.round((LIVE_CASHBACK_PCT_LODGING() / 100) * amt);
      admin = Math.round((platformPct / 100) * amt);
    } else if (splitKind === 'referral' && LIVE_REFERRAL_PCT_LODGING() > 0) {
      user  = Math.round((LIVE_REFERRAL_PCT_LODGING() / 100) * amt);
      admin = Math.round((platformPct / 100) * amt);
    } else {
      admin = Math.round((platformPct / 100) * amt);
    }
  } else {
    const platformPct = LIVE_PLATFORM_PCT_DEFAULT();
    const vendorPct   = 100 - platformPct;
    vendor = Math.round((vendorPct / 100) * amt);
    admin  = Math.round((platformPct / 100) * amt);
  }

  // keep totals consistent
  const diff = amt - (vendor + user + admin);
  if (diff !== 0) admin += diff;

  return { vendor, user, admin };
}

function computeReleaseDate(
  { checkInDate, checkOutDate },
  { policy = 'checkout', bufferHours = 48 } = {}
) {
  const base =
    policy === 'checkin'
      ? (checkInDate || checkOutDate || new Date())
      : (checkOutDate || checkInDate || new Date());
  const ms = (bufferHours || 0) * 60 * 60 * 1000;
  return new Date(new Date(base).getTime() + ms);
}

function oid(v) { try { return new mongoose.Types.ObjectId(String(v)); } catch { return undefined; } }

// ─────────────────────────── Core: booking → ledger ───────────────────────────
/**
 * booking: {
 *   _id, vendorId, totalCost, userId?,
 *   checkInDate?, checkOutDate?,    // or checkIn?, checkOut?
 *   cashbackEligible?, referralUserId?, type?
 * }
 * options: { category?, bufferHours? }
 */
async function recordBookingLedger(booking, options = {}) {
  const {
    _id: bookingId,
    userId,
    vendorId,
    totalCost,
    checkInDate, checkOutDate,
    checkIn, checkOut,
    cashbackEligible,
    referralUserId,
    type,
  } = booking;

  if (!vendorId) throw new Error('recordBookingLedger: booking must have vendorId');

  const category = (options.category || type || 'hotel');
  const catNorm  = normalizeCategory(category);

  // Normalize dates from either set of fields
  const ci = checkInDate || checkIn || null;
  const co = checkOutDate || checkOut || null;

  // Decide who gets the user share
  let splitKind = 'none';
  let recipientUserId = null;
  if (catNorm === 'lodging') {
    const isSelfReferral = referralUserId && userId && String(referralUserId) === String(userId);
    if (referralUserId && !isSelfReferral) {
      splitKind = 'referral';
      recipientUserId = referralUserId;
    } else if (cashbackEligible && userId) {
      splitKind = 'cashback';
      recipientUserId = userId;
    }
  }

  const { vendor, user, admin } = computeSplit(totalCost, { splitKind, category });

  // Vendor payout policy (optional vendor override)
  let vendorPolicy = 'checkout';
  try {
    const v = await Vendor.findById(vendorId).select('payoutPolicy').lean();
    if (v?.payoutPolicy === 'checkin') vendorPolicy = 'checkin';
  } catch { /* ignore */ }

  const vendorReleaseOn = computeReleaseDate({ checkInDate: ci, checkOutDate: co }, { policy: vendorPolicy, bufferHours: 48 });
  const userReleaseOn   = computeReleaseDate({ checkInDate: ci, checkOutDate: co }, { policy: 'checkout',    bufferHours: 48 });

  const PLATFORM_MATURES_WITH_VENDOR = LIVE_MATURES_WITH_VENDOR_FLAG();
  const releaseWithVendor = PLATFORM_MATURES_WITH_VENDOR ? vendorReleaseOn : null;

  // Capture the *fractions* we used (for debugging / audits)
  const metaFractions = {
    platformPctLodging: LIVE_PLATFORM_PCT_LODGING() / 100,
    platformPctDefault: LIVE_PLATFORM_PCT_DEFAULT() / 100,
    cashbackPctHotel:   LIVE_CASHBACK_PCT_LODGING() / 100,
    referralPctHotel:   LIVE_REFERRAL_PCT_LODGING() / 100,
  };

  const rows = [
    vendor > 0 ? {
      accountType: 'vendor',
      accountModel: 'Vendor',
      accountId: oid(vendorId),
      sourceType: 'booking',
      sourceModel: 'Booking',
      sourceId: bookingId,
      bookingId: bookingId,
      direction: 'credit',
      amount: vendor,
      currency: 'NGN',
      status: 'pending',
      releaseOn: vendorReleaseOn,
      reason: 'vendor_share',
      meta: { splitKind, category: catNorm, fractions: metaFractions },
    } : null,

    {
      accountType: 'platform',
      sourceType: 'booking',
      sourceModel: 'Booking',
      sourceId: bookingId,
      bookingId: bookingId,
      direction: 'credit',
      amount: admin,
      currency: 'NGN',
      status: PLATFORM_MATURES_WITH_VENDOR ? 'pending' : 'available',
      releaseOn: PLATFORM_MATURES_WITH_VENDOR ? releaseWithVendor : null,
      reason: 'platform_commission',
      meta: { splitKind, category: catNorm, fractions: metaFractions },
    },
  ].filter(Boolean);

  if (recipientUserId && user > 0) {
    rows.push({
      accountType: 'user',
      accountModel: 'User',
      accountId: oid(recipientUserId),
      sourceType: 'booking',
      sourceModel: 'Booking',
      sourceId: bookingId,
      bookingId: bookingId,
      direction: 'credit',
      amount: user,
      currency: 'NGN',
      status: 'pending',
      releaseOn: userReleaseOn,
      reason: splitKind === 'cashback' ? 'user_cashback' : 'user_referral_commission',
      meta: { splitKind, category: catNorm, fractions: metaFractions },
    });
  }

  dlog('📝 [ledgerService] split=%s | cat=%s | totals=', splitKind, catNorm, { vendor, user, admin });
  dlog('🧾 [ledgerService] inserting %d rows for booking=%s', rows.length, String(bookingId));
  const inserted = await Ledger.insertMany(rows);
  dlog('✅ [ledgerService] inserted _ids = %o', inserted.map(d => String(d._id)));

  return { vendor, user, admin };
}

// ─────────────────────────── Release helpers ───────────────────────────
async function releasePendingForBooking(bookingOrId) {
  const bookingId = typeof bookingOrId === 'object' && bookingOrId !== null
    ? bookingOrId._id
    : bookingOrId;

  const now = new Date();
  const res = await Ledger.updateMany(
    { bookingId, status: 'pending', releaseOn: { $lte: now } },
    { $set: { status: 'available' } }
  );
  return res.modifiedCount || 0;
}

async function releaseDueForVendor(vendorId) {
  const id = oid(vendorId);
  if (!id) return 0;
  const now = new Date();

  // legacy: releaseOn == null
  const a = await Ledger.updateMany(
    {
      accountType: 'vendor',
      accountId: id,
      reason: 'vendor_share',
      status: 'pending',
      releaseOn: null,
    },
    { $set: { status: 'available', releaseOn: now } }
  );

  // normal path: releaseOn ≤ now
  const b = await Ledger.updateMany(
    {
      accountType: 'vendor',
      accountId: id,
      reason: 'vendor_share',
      status: 'pending',
      releaseOn: { $lte: now },
    },
    { $set: { status: 'available' } }
  );

  const matured = (a.modifiedCount || 0) + (b.modifiedCount || 0);
  dlog('⏳ [ledgerService] releaseDueForVendor %s → %d matured', String(id), matured);
  return matured;
}

async function releaseDueForUser(userId) {
  const id = oid(userId);
  if (!id) return 0;
  const now = new Date();

  const REASONS = ['user_cashback', 'user_referral_commission'];

  const a = await Ledger.updateMany(
    {
      accountType: 'user',
      accountId: id,
      reason: { $in: REASONS },
      status: 'pending',
      releaseOn: null,
    },
    { $set: { status: 'available', releaseOn: now } }
  );

  const b = await Ledger.updateMany(
    {
      accountType: 'user',
      accountId: id,
      reason: { $in: REASONS },
      status: 'pending',
      releaseOn: { $lte: now },
    },
    { $set: { status: 'available' } }
  );

  const matured = (a.modifiedCount || 0) + (b.modifiedCount || 0);
  dlog('⏳ [ledgerService] releaseDueForUser %s → %d matured', String(id), matured);
  return matured;
}

async function releaseAllDue() {
  const now = new Date();
  const a = await Ledger.updateMany(
    { reason: 'vendor_share', status: 'pending', releaseOn: null },
    { $set: { status: 'available', releaseOn: now } }
  );
  const b = await Ledger.updateMany(
    { reason: 'vendor_share', status: 'pending', releaseOn: { $lte: now } },
    { $set: { status: 'available' } }
  );
  const REASONS = ['user_cashback', 'user_referral_commission'];
  const c = await Ledger.updateMany(
    { reason: { $in: REASONS }, status: 'pending', releaseOn: null },
    { $set: { status: 'available', releaseOn: now } }
  );
  const d = await Ledger.updateMany(
    { reason: { $in: REASONS }, status: 'pending', releaseOn: { $lte: now } },
    { $set: { status: 'available' } }
  );

  const matured = (a.modifiedCount||0)+(b.modifiedCount||0)+(c.modifiedCount||0)+(d.modifiedCount||0);
  dlog('⏳ [ledgerService] releaseAllDue → %d matured', matured);
  return matured;
}

// ─────────────────────────── Payout debit ───────────────────────────
async function recordPayoutDebit({ accountType, accountId, amount, payoutId, currency = 'NGN' }) {
  if (!accountType || !accountId || !amount) {
    throw new Error('recordPayoutDebit: accountType, accountId, and amount are required');
  }
  return Ledger.create({
    accountType,
    accountModel: accountType === 'vendor' ? 'Vendor' : 'User',
    accountId: oid(accountId),
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payoutId || null,
    direction: 'debit',
    amount: Number(amount),
    currency,
    status: 'available',
    releaseOn: null,
    reason: 'payout',
    meta: payoutId ? { payoutId } : {},
  });
}

// ───────────────────── Platform-only revenue (e.g., chops/gifts) ─────────────────────
async function recordPlatformOnlyRevenue({
  amount,
  bookingId = null,
  currency = 'NGN',
  meta = {},
}) {
  if (!amount) throw new Error('recordPlatformOnlyRevenue: amount is required');

  const PLATFORM_MATURES_WITH_VENDOR = LIVE_MATURES_WITH_VENDOR_FLAG();

  let status = 'available';
  let releaseOn = null;
  if (PLATFORM_MATURES_WITH_VENDOR) {
    status = 'pending';
    // (if ever needed, a releaseOn may be derived later)
  }

  return Ledger.create({
    accountType: 'platform',
    sourceType: 'booking',
    sourceModel: 'Booking',
    sourceId: bookingId || null,
    bookingId: bookingId || null,
    direction: 'credit',
    amount: Number(amount),
    currency,
    status,
    releaseOn,
    reason: 'platform_commission',
    meta,
  });
}

// ───────────────────── CANCELLATION / REVERSALS ─────────────────────
async function mirrorCreditsAsReversalDebits(rows, { kind }) {
  if (!rows?.length) return 0;
  const docs = rows.map(r => ({
    accountType: r.accountType,
    accountModel: r.accountModel,
    accountId: r.accountId,
    sourceType: 'booking',
    sourceModel: 'Booking',
    sourceId: r.bookingId || r.sourceId || null,
    bookingId: r.bookingId || null,
    direction: 'debit',
    amount: r.amount,
    currency: r.currency || 'NGN',
    status: r.status,
    releaseOn: r.releaseOn || null,
    reason: 'adjustment',
    meta: { cancelOf: r._id, kind, note: 'Cancellation reversal' },
    createdAt: new Date(),
  }));
  const res = await Ledger.insertMany(docs);
  dlog('↩️  [ledgerService] inserted %d reversal debits (kind=%s)', res.length, kind);
  return res.length;
}

async function reverseCashbackForBooking(bookingId) {
  const rows = await Ledger.find({
    bookingId,
    accountType: 'user',
    direction: 'credit',
    reason: 'user_cashback',
  }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'cashback' });
}

async function reverseReferralForBooking(bookingId) {
  const rows = await Ledger.find({
    bookingId,
    accountType: 'user',
    direction: 'credit',
    reason: 'user_referral_commission',
  }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'referral' });
}

async function reverseUserIncentivesForBooking(bookingId) {
  const a = await reverseCashbackForBooking(bookingId);
  const b = await reverseReferralForBooking(bookingId);
  return a + b;
}

async function reverseVendorShareForBooking(bookingId) {
  const rows = await Ledger.find({
    bookingId,
    accountType: 'vendor',
    direction: 'credit',
    reason: 'vendor_share',
  }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'vendor_share' });
}

async function reversePlatformCommissionForBooking(bookingId) {
  const rows = await Ledger.find({
    bookingId,
    accountType: 'platform',
    direction: 'credit',
    reason: 'platform_commission',
  }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'platform_commission' });
}

async function undoLedgerForBooking(bookingId, opts = {}) {
  const { user = true, vendor = true, platform = false } = opts;

  let total = 0;
  if (user)     total += await reverseUserIncentivesForBooking(bookingId);
  if (vendor)   total += await reverseVendorShareForBooking(bookingId);
  if (platform) total += await reversePlatformCommissionForBooking(bookingId);

  dlog('🧹 [ledgerService] undoLedgerForBooking booking=%s → inserted %d reversal debits', String(bookingId), total);
  return total;
}

// ───────────────────── USER SUMMARY (for widgets) ─────────────────────
async function getUserEarningsSummary(userId) {
  const id = oid(userId);
  if (!id) return {
    balances: { pending: 0, available: 0 },
    cashback: { gross: 0, reversals: 0, net: 0 },
    referral: { gross: 0, reversals: 0, net: 0 },
  };

  const [pendingAgg, availableAgg, cbGrossAgg, cbRevAgg, rfGrossAgg, rfRevAgg] = await Promise.all([
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, status: 'pending' } },
      { $group: {
        _id: null,
        credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
        debit:  { $sum: { $cond: [{ $eq: ['$direction', 'debit']  }, '$amount', 0] } },
      }},
      { $project: { amount: { $subtract: ['$credit', '$debit'] } } },
    ]),
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, status: 'available' } },
      { $group: {
        _id: null,
        credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
        debit:  { $sum: { $cond: [{ $eq: ['$direction', 'debit']  }, '$amount', 0] } },
      }},
      { $project: { amount: { $subtract: ['$credit', '$debit'] } } },
    ]),
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, direction: 'credit', reason: 'user_cashback' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Ledger.aggregate([
      { $match: {
        accountType: 'user', accountId: id,
        direction: 'debit', reason: 'adjustment',
        'meta.kind': 'cashback', 'meta.cancelOf': { $exists: true },
      }},
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, direction: 'credit', reason: 'user_referral_commission' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Ledger.aggregate([
      { $match: {
        accountType: 'user', accountId: id,
        direction: 'debit', reason: 'adjustment',
        'meta.kind': 'referral', 'meta.cancelOf': { $exists: true },
      }},
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const pending   = Number(pendingAgg[0]?.amount || 0);
  const available = Number(availableAgg[0]?.amount || 0);

  const cbGross = Number(cbGrossAgg[0]?.total || 0);
  const cbRev   = Number(cbRevAgg[0]?.total || 0);
  const rfGross = Number(rfGrossAgg[0]?.total || 0);
  const rfRev   = Number(rfRevAgg[0]?.total || 0);

  return {
    balances: { pending, available },
    cashback: { gross: cbGross, reversals: cbRev, net: cbGross - cbRev },
    referral: { gross: rfGross, reversals: rfRev, net: rfGross - rfRev },
  };
}

// ─────────────────────────── Exports ───────────────────────────
module.exports = {
  normalizeCategory,
  computeSplit,
  computeReleaseDate,
  recordBookingLedger,
  releasePendingForBooking,

  // NEW:
  releaseDueForVendor,
  releaseDueForUser,
  releaseAllDue,

  creditOnPayment: recordBookingLedger,
  recordPayoutDebit,
  recordPlatformOnlyRevenue,

  // Reversals
  reverseCashbackForBooking,
  reverseReferralForBooking,
  reverseUserIncentivesForBooking,
  reverseVendorShareForBooking,
  reversePlatformCommissionForBooking,
  undoLedgerForBooking,

  // User summary for dashboard
  getUserEarningsSummary,
};

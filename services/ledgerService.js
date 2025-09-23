// services/ledgerService.js
require('dotenv').config();
const mongoose = require('mongoose');
const Ledger = require('../models/ledgerModel');
const Vendor = require('../models/vendorModel');
const config = require('./configService'); // DB + cache-backed settings

// ────────────────────────── Debug helpers ──────────────────────────
const LEDGER_DEBUG = String(process.env.LEDGER_DEBUG || '0') === '1';
const dlog  = (...a) => { if (LEDGER_DEBUG) console.log('[ledger]', ...a); };
const dwarn = (...a) => { if (LEDGER_DEBUG) console.warn('[ledger]', ...a); };
const derr  = (...a) => { if (LEDGER_DEBUG) console.error('[ledger]', ...a); };

// ─────────────────────── Runtime config helpers ────────────────────
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

// Live getters (use cached DB values; fall back to env/default)
function LIVE_PLATFORM_PCT_LODGING()     { return getPct('platform_pct_lodging',        'PLATFORM_PCT_LODGING', 15); }
function LIVE_CASHBACK_PCT_LODGING()     { return getPct('cashback_pct_lodging',        'CASHBACK_PCT_LODGING', 3); }
function LIVE_REFERRAL_PCT_LODGING()     { return getPct('referral_pct_lodging',        'REFERRAL_PCT_LODGING', 3); }
function LIVE_PLATFORM_PCT_DEFAULT()     { return getPct('platform_pct_default',        'PLATFORM_PCT_DEFAULT', 15); }
function LIVE_PLATFORM_PCT_EVENT()       { return getPct('platform_pct_event_center',   'PLATFORM_PCT_EVENT', 15); }
function LIVE_CASHBACK_PCT_EVENT()       { return getPct('cashback_pct_event_center',   'CASHBACK_PCT_EVENT', 0); }
function LIVE_REFERRAL_PCT_EVENT()       { return getPct('referral_pct_event_center',   'REFERRAL_PCT_EVENT', 0); }
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
  } else if (cat === 'event_center') {
    const platformPct = LIVE_PLATFORM_PCT_EVENT();
    const vendorPct   = 100 - platformPct;
    vendor = Math.round((vendorPct / 100) * amt);

    if (splitKind === 'cashback' && LIVE_CASHBACK_PCT_EVENT() > 0) {
      user  = Math.round((LIVE_CASHBACK_PCT_EVENT() / 100) * amt);
      admin = Math.round((platformPct / 100) * amt);
    } else if (splitKind === 'referral' && LIVE_REFERRAL_PCT_EVENT() > 0) {
      user  = Math.round((LIVE_REFERRAL_PCT_EVENT() / 100) * amt);
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
  dlog('releasePendingForBooking booking=%s → matured=%d', String(bookingId), res.modifiedCount || 0);
  return res.modifiedCount || 0;
}

// ─────────────────────── booking → ledger (TRACE ADDED) ───────────────────────
async function recordBookingLedger(booking, options = {}) {
  try {
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

    if (!vendorId) {
      dwarn('recordBookingLedger: missing vendorId; booking=%o', {
        bookingId, userId, vendorId, totalCost, type
      });
      throw new Error('recordBookingLedger: booking must have vendorId');
    }

    const category = (options.category || type || 'hotel');
    const catNorm  = normalizeCategory(category);

    const ci = checkInDate || checkIn || null;
    const co = checkOutDate || checkOut || null;

    // Decide who gets the user share
    let splitKind = 'none';
    let recipientUserId = null;

    if (catNorm === 'lodging' || catNorm === 'event_center') {
      const isSelfReferral = referralUserId && userId && String(referralUserId) === String(userId);
      if (referralUserId && !isSelfReferral) {
        splitKind = 'referral';
        recipientUserId = referralUserId;
      } else if (cashbackEligible && userId) {
        splitKind = 'cashback';
        recipientUserId = userId;
      }
    }

    // Snapshot the knob values used
    const knobSnapshot = {
      catNorm,
      platformPct: (catNorm === 'lodging')     ? LIVE_PLATFORM_PCT_LODGING()
                   : (catNorm === 'event_center') ? LIVE_PLATFORM_PCT_EVENT()
                   : LIVE_PLATFORM_PCT_DEFAULT(),
      cashbackPct: (catNorm === 'lodging') ? LIVE_CASHBACK_PCT_LODGING()
                   : (catNorm === 'event_center') ? LIVE_CASHBACK_PCT_EVENT() : 0,
      referralPct: (catNorm === 'lodging') ? LIVE_REFERRAL_PCT_LODGING()
                   : (catNorm === 'event_center') ? LIVE_REFERRAL_PCT_EVENT() : 0,
      platformMaturesWithVendor: LIVE_MATURES_WITH_VENDOR_FLAG(),
    };

    console.log('[ledger:recordBookingLedger:req]', {
      bookingId: String(bookingId),
      vendorId: String(vendorId),
      userId: userId ? String(userId) : null,
      totalCost: Number(totalCost),
      category: category, catNorm,
      cashbackEligible: !!cashbackEligible,
      referralUserId: referralUserId ? String(referralUserId) : null,
      splitKind,
      recipientUserId: recipientUserId ? String(recipientUserId) : null,
      ci, co,
      knobs: knobSnapshot,
    });

    const { vendor, user, admin } = computeSplit(totalCost, { splitKind, category });

    // Vendor release policy
    let vendorPolicy = 'checkout';
    try {
      const v = await Vendor.findById(vendorId).select('payoutPolicy').lean();
      if (v?.payoutPolicy === 'checkin') vendorPolicy = 'checkin';
    } catch (e) { dwarn('vendor payoutPolicy lookup failed:', e?.message || e); }

    const vendorReleaseOn = computeReleaseDate({ checkInDate: ci, checkOutDate: co }, { policy: vendorPolicy, bufferHours: 48 });
    const userReleaseOn   = computeReleaseDate({ checkInDate: ci, checkOutDate: co }, { policy: 'checkout',    bufferHours: 48 });

    const PLATFORM_MATURES_WITH_VENDOR = LIVE_MATURES_WITH_VENDOR_FLAG();
    const releaseWithVendor = PLATFORM_MATURES_WITH_VENDOR ? vendorReleaseOn : null;

    const metaFractions = {
      platformPctLodging:    LIVE_PLATFORM_PCT_LODGING() / 100,
      platformPctDefault:    LIVE_PLATFORM_PCT_DEFAULT() / 100,
      cashbackPctHotel:      LIVE_CASHBACK_PCT_LODGING() / 100,
      referralPctHotel:      LIVE_REFERRAL_PCT_LODGING() / 100,
      platformPctEvent:      LIVE_PLATFORM_PCT_EVENT() / 100,
      cashbackPctEvent:      LIVE_CASHBACK_PCT_EVENT() / 100,
      referralPctEvent:      LIVE_REFERRAL_PCT_EVENT() / 100,
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
    } else if (splitKind !== 'none') {
      dwarn('splitKind=%s but no user row created (recipient=%s, userAmt=%s)', splitKind, recipientUserId, user);
    }

    dlog('assemble rows', { count: rows.length, vendor, user, admin, splitKind });

    const inserted = await Ledger.insertMany(rows);
    console.log('[ledger:recordBookingLedger:ok]', {
      bookingId: String(bookingId),
      insertedIds: inserted.map(d => String(d._id)),
      counts: { vendor, user, admin },
      splitKind,
    });

    // Post-insert sanity: count by bookingId
    try {
      const c = await Ledger.countDocuments({ bookingId });
      dlog('post-insert ledger count for booking=%s → %d', String(bookingId), c);
    } catch (e) { dwarn('post-insert count failed:', e?.message || e); }

    return { vendor, user, admin };
  } catch (e) {
    derr('recordBookingLedger error:', e?.message || e);
    throw e;
  }
}

// ─────────────────────────── Minimal platform-only revenue helper ───────────────────────────
// Keeps parity with previous exports. Creates a single platform credit row.
// Use for categories where the full amount is platform revenue (e.g., chops/gifts).
async function recordPlatformOnlyRevenue({ bookingId = null, amount, category = 'other', currency = 'NGN', meta = {} }) {
  const catNorm = normalizeCategory(category);
  const amt = Math.max(0, Number(amount || 0));
  if (!amt) return null;

  const doc = await Ledger.create({
    accountType: 'platform',
    sourceType: 'booking',
    sourceModel: 'Booking',
    sourceId: bookingId || null,
    bookingId: bookingId || null,
    direction: 'credit',
    amount: amt,
    currency,
    status: 'available',
    releaseOn: null,
    reason: 'platform_commission',
    meta: { category: catNorm, ...meta },
  });

  dlog('recordPlatformOnlyRevenue → _id=%s amount=%d category=%s', String(doc._id), amt, catNorm);
  return doc;
}

// ─────────────────────────── Other helpers (unchanged except logs) ───────────────────────────
async function releaseDueForVendor(vendorId) {
  const id = oid(vendorId);
  if (!id) return 0;
  const now = new Date();

  const a = await Ledger.updateMany(
    { accountType: 'vendor', accountId: id, reason: 'vendor_share', status: 'pending', releaseOn: null },
    { $set: { status: 'available', releaseOn: now } }
  );
  const b = await Ledger.updateMany(
    { accountType: 'vendor', accountId: id, reason: 'vendor_share', status: 'pending', releaseOn: { $lte: now } },
    { $set: { status: 'available' } }
  );

  const matured = (a.modifiedCount || 0) + (b.modifiedCount || 0);
  dlog('releaseDueForVendor %s → %d', String(id), matured);
  return matured;
}

async function releaseDueForUser(userId) {
  const id = oid(userId);
  if (!id) return 0;
  const now = new Date();
  const REASONS = ['user_cashback', 'user_referral_commission'];

  const a = await Ledger.updateMany(
    { accountType: 'user', accountId: id, reason: { $in: REASONS }, status: 'pending', releaseOn: null },
    { $set: { status: 'available', releaseOn: now } }
  );
  const b = await Ledger.updateMany(
    { accountType: 'user', accountId: id, reason: { $in: REASONS }, status: 'pending', releaseOn: { $lte: now } },
    { $set: { status: 'available' } }
  );

  const matured = (a.modifiedCount || 0) + (b.modifiedCount || 0);
  dlog('releaseDueForUser %s → %d', String(id), matured);
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
  dlog('releaseAllDue → %d matured', matured);
  return matured;
}

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
    meta: { payoutId: payoutId || null },
  });
}

// Reversal helpers (unchanged)
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
  dlog('inserted %d reversal debits (kind=%s)', res.length, kind);
  return res.length;
}
async function reverseCashbackForBooking(bookingId) {
  const rows = await Ledger.find({ bookingId, accountType: 'user', direction: 'credit', reason: 'user_cashback' }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'cashback' });
}
async function reverseReferralForBooking(bookingId) {
  const rows = await Ledger.find({ bookingId, accountType: 'user', direction: 'credit', reason: 'user_referral_commission' }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'referral' });
}
async function reverseUserIncentivesForBooking(bookingId) {
  const a = await reverseCashbackForBooking(bookingId);
  const b = await reverseReferralForBooking(bookingId);
  return a + b;
}
async function reverseVendorShareForBooking(bookingId) {
  const rows = await Ledger.find({ bookingId, accountType: 'vendor', direction: 'credit', reason: 'vendor_share' }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'vendor_share' });
}
async function reversePlatformCommissionForBooking(bookingId) {
  const rows = await Ledger.find({ bookingId, accountType: 'platform', direction: 'credit', reason: 'platform_commission' }).lean();
  return mirrorCreditsAsReversalDebits(rows, { kind: 'platform_commission' });
}
async function undoLedgerForBooking(bookingId, opts = {}) {
  const { user = true, vendor = true, platform = false } = opts;
  let total = 0;
  if (user)     total += await reverseUserIncentivesForBooking(bookingId);
  if (vendor)   total += await reverseVendorShareForBooking(bookingId);
  if (platform) total += await reversePlatformCommissionForBooking(bookingId);
  dlog('undoLedgerForBooking booking=%s → inserted %d reversal debits', String(bookingId), total);
  return total;
}

// Summary (unchanged)
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
      { $match: { accountType: 'user', accountId: id, direction: 'debit', reason: 'adjustment', 'meta.kind': 'cashback', 'meta.cancelOf': { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, direction: 'credit', reason: 'user_referral_commission' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    Ledger.aggregate([
      { $match: { accountType: 'user', accountId: id, direction: 'debit', reason: 'adjustment', 'meta.kind': 'referral', 'meta.cancelOf': { $exists: true } } },
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

module.exports = {
  normalizeCategory,
  computeSplit,
  computeReleaseDate,
  recordBookingLedger,
  releasePendingForBooking,
  releaseDueForVendor,
  releaseDueForUser,
  releaseAllDue,
  creditOnPayment: recordBookingLedger,
  recordPayoutDebit,
  recordPlatformOnlyRevenue, // ← now defined
  reverseCashbackForBooking,
  reverseReferralForBooking,
  reverseUserIncentivesForBooking,
  reverseVendorShareForBooking,
  reversePlatformCommissionForBooking,
  undoLedgerForBooking,
  getUserEarningsSummary,
};

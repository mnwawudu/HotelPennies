// routes/adminDashboardRoutes.js  
const express = require('express');
const router = express.Router();

const mongoose = require('mongoose');
const auth = require('../middleware/adminAuth');
const axios = require('axios');

// models
const Admin = require('../models/adminModel');
const Hotel = require('../models/hotelModel');
const Shortlet = require('../models/shortletModel');
const Restaurant = require('../models/restaurantModel');
const EventCenter = require('../models/eventCenterModel');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const Booking = require('../models/bookingModel');
const Ad = require('../models/advertModel');
const Order = require('../models/orderModel');
const Page = require('../models/pageModel');
const Payout = require('../models/payoutModel');
const Ledger = require('../models/ledgerModel');
const FeatureListing = require('../models/featureListingModel');


// ---------------- utils ----------------
const normalizeKey = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, '');
const CATEGORY_WHITELIST = ['hotel','shortlet','restaurant','eventcenter','tourguide','menu','chop','gift','cruise','carhire'];

// ===== Reason sets / regex (mirror user routes) =====
const USER_CREDIT_REASONS = [
  'user_cashback',
  'cashback',
  'user_referral_commission',
  'referral_commission',
  'ref_commission',
];
const CASHBACK_RE = /cashback/i;
const REF_OR_COMM_RE = /(referral|commission)/i;
const REVERSAL_MARK_RE = /(cashback|referral|commission)/i;

// 48h window (mirror user)
const USER_RELEASE_HOURS = Number(process.env.USER_RELEASE_HOURS || 48);

// build “effective available” conditions onto a $match (same semantics as user)
function applyEffectiveStatus(match, desiredStatus) {
  const now = new Date();
  const releaseMs = USER_RELEASE_HOURS * 60 * 60 * 1000;

  if (desiredStatus === 'available') {
    if (match.status) delete match.status;
    match.$and = (match.$and || []).concat([{
      $or: [
        { status: 'available' },
        {
          $and: [
            { status: { $in: ['pending', 'hold', 'locked', 'requested', 'approved', 'processing'] } },
            {
              $or: [
                { releaseOn: { $lte: now } },
                { releaseOn: { $exists: false } },
                { createdAt: { $lte: new Date(now.getTime() - releaseMs) } },
              ]
            }
          ]
        }
      ]
    }]);
  }
}

// ----- helpers to sum amounts with aggregation -----
async function sumAgg(pipeline) {
  const rows = await Ledger.aggregate(pipeline);
  return rows?.[0]?.total || 0;
}

// Effective available for ONE account (vendor|user)
async function getEffectiveAvailableBalance(accountType, idStr) {
  const accountId = new mongoose.Types.ObjectId(idStr);

  // Credits (earnings)
  const creditMatch = {
    accountType,
    accountId,
    direction: 'credit',
    ...(accountType === 'vendor'
      ? { reason: 'vendor_share' }
      : {
          $or: [
            { reason: { $in: USER_CREDIT_REASONS } },
            { reason: CASHBACK_RE },
            { reason: REF_OR_COMM_RE },
            { 'meta.splitKind': { $in: ['cashback', 'referral'] } },
          ],
        }),
  };
  applyEffectiveStatus(creditMatch, 'available');

  const creditTotal = await sumAgg([
    { $match: creditMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  // Debits (reversals/adjustments that offset earnings)
  const reversalMatch = {
    accountType,
    accountId,
    direction: 'debit',
    $or: [
      // rare direct debit with same reason
      ...(accountType === 'vendor'
        ? [{ reason: 'vendor_share' }]
        : [{ reason: { $in: USER_CREDIT_REASONS } }, { reason: CASHBACK_RE }, { reason: REF_OR_COMM_RE }]),
      // adjustments tagged as reversals
      { $and: [{ reason: 'adjustment' }, { $or: [{ 'meta.kind': REVERSAL_MARK_RE }, { 'meta.subtype': REVERSAL_MARK_RE }] }] },
    ],
  };
  applyEffectiveStatus(reversalMatch, 'available');

  const reversalTotal = await sumAgg([
    { $match: reversalMatch },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  // Payout debits (already locked/available) — keep strict
  const payoutTotal = await sumAgg([
    {
      $match: {
        accountType,
        accountId,
        direction: 'debit',
        reason: 'payout',
        status: 'available',
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  return Number(creditTotal) - Number(reversalTotal) - Number(payoutTotal);
}

// Effective available MAP for ALL accounts of a type
async function getEffectiveAvailableMap(accountType) {
  // Credits
  const creditMatch = {
    accountType,
    direction: 'credit',
    ...(accountType === 'vendor'
      ? { reason: 'vendor_share' }
      : {
          $or: [
            { reason: { $in: USER_CREDIT_REASONS } },
            { reason: CASHBACK_RE },
            { reason: REF_OR_COMM_RE },
            { 'meta.splitKind': { $in: ['cashback', 'referral'] } },
          ],
        }),
  };
  applyEffectiveStatus(creditMatch, 'available');

  const creditRows = await Ledger.aggregate([
    { $match: creditMatch },
    { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
  ]);

  // Reversal debits (effective)
  const reversalMatch = {
    accountType,
    direction: 'debit',
    $or: [
      ...(accountType === 'vendor'
        ? [{ reason: 'vendor_share' }]
        : [{ reason: { $in: USER_CREDIT_REASONS } }, { reason: CASHBACK_RE }, { reason: REF_OR_COMM_RE }]),
      { $and: [{ reason: 'adjustment' }, { $or: [{ 'meta.kind': REVERSAL_MARK_RE }, { 'meta.subtype': REVERSAL_MARK_RE }] }] },
    ],
  };
  applyEffectiveStatus(reversalMatch, 'available');

  const reversalRows = await Ledger.aggregate([
    { $match: reversalMatch },
    { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
  ]);

  // Payout debits (strict)
  const payoutRows = await Ledger.aggregate([
    { $match: { accountType, direction: 'debit', reason: 'payout', status: 'available' } },
    { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
  ]);

  // Compose map
  const map = new Map();
  for (const r of creditRows) map.set(String(r._id), Number(r.total || 0));
  for (const r of reversalRows) map.set(String(r._id), (map.get(String(r._id)) || 0) - Number(r.total || 0));
  for (const r of payoutRows) map.set(String(r._id), (map.get(String(r._id)) || 0) - Number(r.total || 0));
  return map;
}

// Existing lock for a payout (unchanged)
async function getExistingLockAmount(payoutId) {
  const rows2 = await Ledger.aggregate([
    { $match: {
      sourceType: 'payout',
      sourceModel: 'Payout',
      sourceId: new mongoose.Types.ObjectId(payoutId),
      direction: 'debit',
      status: 'available'
    }},
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  return rows2[0]?.total || 0;
}

// SAFETY: assert payout amount <= effective available (+ any lock we created earlier)
async function assertEligiblePayout(payout) {
  const accountId = String(payout.vendorId || payout.userId);
  const payeeType = payout.payeeType;
  const [effectiveNow, existingLock] = await Promise.all([
    getEffectiveAvailableBalance(payeeType, accountId),
    getExistingLockAmount(payout._id)
  ]);
  const effective = Number(effectiveNow) + Number(existingLock);
  if (effective < Number(payout.amount || 0)) {
    const msg = `Amount exceeds available balance (₦${Number(effectiveNow).toLocaleString()})`;
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

/* ======================
   helpers for features
   ====================== */
async function activeFeatureCounts() {
  const now = new Date();
  const match = {
    isPaid: true,
    featuredFrom: { $lte: now },
    featuredTo: { $gte: now },
    $or: [{ disabled: { $exists: false } }, { disabled: { $ne: true } }],
  };

  const rows = await FeatureListing.aggregate([
    { $match: match },
    { $group: { _id: '$resourceType', count: { $sum: 1 } } },
  ]);

  const map = Object.fromEntries(rows.map(r => [r._id, r.count]));
  const total =
    (map.room || 0) +
    (map.menu || 0) +
    (map.shortlet || 0) +
    (map.restaurant || 0) +
    (map.eventcenter || 0) +
    (map.tourguide || 0) +
    (map.chop || 0) +
    (map.gift || 0);

  return { total, breakdown: map };
}

/* ======================
   DASHBOARD OVERVIEW
   ====================== */
router.get('/overview', auth, async (req, res) => {
  try {
    const [
      userCount, vendorCount, hotelCount, shortletCount, restaurantCount, eventCenterCount,
      activeAdCount,
      featureStats,
    ] = await Promise.all([
      User.countDocuments(),
      Vendor.countDocuments(),
      Hotel.countDocuments(),
      Shortlet.countDocuments(),
      Restaurant.countDocuments(),
      EventCenter.countDocuments(),
      Ad.countDocuments({ active: true }),
      activeFeatureCounts(),
    ]);

    res.json({
      totalBusinesses: hotelCount + shortletCount + restaurantCount + eventCenterCount,
      activeAds: activeAdCount,
      featuredListings: featureStats.total,
      featuredBreakdown: featureStats.breakdown,
    });
  } catch (err) {
    console.error('Admin overview error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ======================
   VENDOR LIST (rich data)
   ====================== */
router.get('/vendors', auth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit || '500', 10), 1), 1000);
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const like = (s) => ({ $regex: s, $options: 'i' });

    const filter = q
      ? { $or: [
          { name: like(q) },
          { businessName: like(q) },
          { email: like(q) },
          { phone: like(q) },
          { address: like(q) },
          { state: like(q) },
          { city: like(q) },
          { 'businessTypes.serviceType': like(q) },
        ] }
      : {};

    const baseQuery = Vendor.find(filter).sort({ createdAt: -1 });
    if (page > 0) baseQuery.skip((page - 1) * limit).limit(limit);

    const vendors = await baseQuery.lean();
    const ids = vendors.map(v => v._id);

    const shareAgg = await Ledger.aggregate([
      { $match: { accountType: 'vendor', accountId: { $in: ids }, reason: 'vendor_share', direction: 'credit' } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    const cancelRevAgg = await Ledger.aggregate([
      { $match: { accountType: 'vendor', accountId: { $in: ids }, reason: 'adjustment', direction: 'debit', 'meta.cancelOf': { $exists: true } } },
      { $lookup: { from: 'ledgers', localField: 'meta.cancelOf', foreignField: '_id', as: 'base' } },
      { $unwind: { path: '$base', preserveNullAndEmptyArrays: false } },
      { $match: { 'base.reason': 'vendor_share' } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    const otherAdjAgg = await Ledger.aggregate([
      { $match: {
          accountType: 'vendor',
          accountId: { $in: ids },
          reason: 'adjustment',
          direction: 'debit',
          $or: [{ 'meta.cancelOf': { $exists: false } }, { 'meta.cancelOf': null }] } },
      { $group: { _id: '$accountId', total: { $sum: '$amount' } } },
    ]);

    const shareMap  = new Map(shareAgg.map(r => [String(r._id), Number(r.total || 0)]));
    const cancelMap = new Map(cancelRevAgg.map(r => [String(r._id), Number(r.total || 0)]));
    const otherMap  = new Map(otherAdjAgg.map(r => [String(r._id), Number(r.total || 0)]));

    const rows = vendors.map(v => {
      const docs = v.documents || {};
      const docsOk = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
      const rawKyc = String(v.kycStatus || 'PENDING').toUpperCase();
      const displayKyc = (v.isFullyVerified || docsOk || rawKyc === 'APPROVED') ? 'APPROVED' : rawKyc;

      const services = Array.isArray(v.businessTypes)
        ? v.businessTypes.map(b => (typeof b === 'string' ? b : b?.serviceType)).filter(Boolean)
        : [];

      const share  = shareMap.get(String(v._id))  || 0;
      const cancel = cancelMap.get(String(v._id)) || 0;
      const other  = otherMap.get(String(v._id))  || 0;
      const lifetimeNet = Math.max(0, share - (cancel + other));

      return {
        _id: v._id,
        name: v.businessName || v.name || 'Vendor',
        email: v.email || '',
        phone: v.phone || '',
        address: v.address || '',
        state: v.state || '',
        city: v.city || '',
        businessTypes: services,
        documents: {
          meansOfId: !!docs.meansOfId,
          cacCertificate: !!docs.cacCertificate,
          proofOfAddress: !!docs.proofOfAddress,
        },
        status: v.status || 'active',
        isFullyVerified: !!v.isFullyVerified,
        kycStatus: displayKyc,
        totalEarned: lifetimeNet,
        createdAt: v.createdAt,
      };
    });

    res.json(rows);
  } catch (err) {
    console.error('Admin vendors error:', err);
    res.status(500).json({ message: 'Failed to load vendors' });
  }
});

/* ======================
   PAYSTACK HELPERS
   ====================== */
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Normalizer for bank matching
const norm = (s = '') =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(nig|nigeria|intl|international|ventures|ltd|limited|plc|inc|llc|co|company|and|&)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Wrap Paystack calls so we can bubble up the *real* error
async function paystackCall(method, path, body) {
  try {
    const { data } = await axios({
      method,
      url: `https://api.paystack.co${path}`,
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      data: body,
    });
    return data;
  } catch (e) {
    const pd = e?.response?.data;
    const msg = pd?.message || e.message || 'Paystack error';
    const err = new Error(msg);
    err.statusCode = e?.response?.status || 400;
    err.paystack = {
      message: msg,
      code: pd?.code || pd?.error || e.code || null,
      type: pd?.type || null,
      meta: pd?.meta || null,
      raw: pd || null,
    };
    throw err;
  }
}

async function resolveBankCode(bankName) {
  if (!bankName) return null;
  try {
    const data = await paystackCall('get', '/bank?currency=NGN');
    const banks = Array.isArray(data?.data) ? data.data : [];
    const target = norm(bankName);
    const found = banks.find(
      (b) => norm(b.name) === target || norm(b.name).includes(target)
    );
    return found?.code || null;
  } catch (e) {
    console.warn('⚠️ resolveBankCode failed:', e?.paystack || e.message);
    return null;
  }
}

async function ensureRecipient({ accountName, accountNumber, bankCode }) {
  const payload = {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  };
  const data = await paystackCall('post', '/transferrecipient', payload);
  if (!data?.status) throw new Error('Failed to create transfer recipient');
  return data.data; // {recipient_code,...}
}

async function initiateTransfer({ amountNaira, recipient_code, reason, reference }) {
  const initPayload = {
    source: 'balance',
    amount: Math.round(Number(amountNaira) * 100), // KOBO
    recipient: recipient_code,
    reason,
    ...(reference ? { reference } : {}),
  };
  const init = await paystackCall('post', '/transfer', initPayload);

  // Optional OTP flow
  if (init?.data?.status === 'otp' && process.env.PAYSTACK_TRANSFER_OTP) {
    const fin = await paystackCall('post', '/transfer/finalize_transfer', {
      transfer_code: init.data.transfer_code,
      otp: process.env.PAYSTACK_TRANSFER_OTP,
    });
    return { initiated: init.data, finalized: fin?.data || null };
  }

  return { initiated: init?.data || null, finalized: null };
}

// Pull bank snapshot
async function resolvePayeeBankForPayout(payout) {
  const snap = payout.bank || {};
  let bankName = snap.bankName || snap.bank?.name || null;
  let bankCode = snap.bankCode || snap.bank?.code || null;
  let accountNumber = snap.accountNumber || snap.bank?.accountNumber || null;
  let accountName = snap.accountName || snap.bank?.accountName || null;

  if (!(accountNumber && accountName && (bankCode || bankName))) {
    if (payout.payeeType === 'vendor') {
      const v = await Vendor.findById(payout.vendorId).lean();
      const arr = Array.isArray(v?.payoutAccounts) ? v.payoutAccounts : [];
      const idx = Number.isInteger(v?.lockedPayoutAccountIndex) ? v.lockedPayoutAccountIndex : -1;
      const pick = (idx >= 0 && idx < arr.length) ? arr[idx] : arr[0];
      if (pick) {
        bankName = pick.bankName || bankName;
        bankCode = pick.bankCode || bankCode;
        accountNumber = pick.accountNumber || accountNumber;
        accountName = pick.accountName || accountName;
      }
    } else {
      const u = await User.findById(payout.userId).lean();
      bankName = u?.bankName || u?.bank?.name || bankName;
      bankCode = u?.bankCode || u?.bank?.code || bankCode;
      accountNumber = u?.accountNumber || u?.bank?.accountNumber || accountNumber;
      accountName = u?.accountName || u?.bank?.accountName || accountName;
    }
  }

  if (!bankCode && bankName) {
    bankCode = await resolveBankCode(bankName);
  }

  return { bankName, bankCode, accountNumber, accountName };
}

/* ======================
   PAYOUTS LIST
   ====================== */
router.get('/payouts', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10), 1), 200);
    const rawStatus = (req.query.status || 'all').toString().toLowerCase();
    const rawType = (req.query.type || 'all').toString().toLowerCase();

    const statusMap = {
      all: null,
      submitted: ['submitted','requested','approved','pending'],
      pending:   ['submitted','requested','approved','pending'],
      processing: ['processing'],
      paid: ['paid'],
      failed: ['failed','cancelled','rejected'],
    };
    const statusList = statusMap[rawStatus] || null;

    const match = {};
    if (rawType === 'vendor') match.payeeType = 'vendor';
    if (rawType === 'user') match.payeeType = 'user';
    if (statusList) match.status = { $in: statusList };

    const pipeline = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $addFields: {
          vendorIdStr: { $cond: [{ $ifNull: ['$vendorId', false] }, { $toString: '$vendorId' }, null] },
          userIdStr:   { $cond: [{ $ifNull: ['$userId',   false] }, { $toString: '$userId' }, null] },
          amountNum:   { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } },
          uiStatus: {
            $switch: {
              branches: [
                { case: { $in: ['$status', ['submitted','requested','approved','pending']] }, then: 'pending' },
                { case: { $in: ['$status', ['cancelled','rejected','failed']] }, then: 'failed' },
              ],
              default: '$status',
            }
          }
      } },
      { $lookup: {
          from: 'vendors',
          let: { vid: '$vendorIdStr' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$vid'] } } },
            { $project: { _id: 1, businessName: 1, name: 1, email: 1 } },
          ],
          as: 'vendor',
      } },
      { $lookup: {
          from: 'users',
          let: { uid: '$userIdStr' },
          pipeline: [
            { $match: { $expr: { $eq: [{ $toString: '$_id' }, '$$uid'] } } },
            { $project: { _id: 1, name: 1, email: 1 } },
          ],
          as: 'user',
      } },
      { $addFields: {
          payeeName: {
            $cond: [
              { $eq: ['$payeeType', 'vendor'] },
              { $ifNull: [{ $first: '$vendor.businessName' }, { $first: '$vendor.name' }] },
              { $first: '$user.name' },
            ],
          },
          payeeEmail: {
            $cond: [
              { $eq: ['$payeeType', 'vendor'] },
              { $first: '$vendor.email' },
              { $first: '$user.email' },
            ],
          },
      } },
      { $project: { vendor: 0, user: 0 } },
    ];

    const [rows, total] = await Promise.all([
      Payout.aggregate(pipeline),
      Payout.countDocuments(match),
    ]);

    res.json({ data: rows, total, page, limit });
  } catch (err) {
    console.error('Admin payouts error:', err);
    res.status(500).json({ message: 'Failed to load payouts' });
  }
});

/* ======================
   STATUS TRANSITIONS & MONEY EFFECTS
   ====================== */
async function createHoldDebitIfMissing(payout) {
  const hasLock = await Ledger.exists({
    accountType: payout.payeeType,
    accountId: payout.vendorId || payout.userId,
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payout._id,
    direction: 'debit',
    reason: 'payout',
    status: 'available',
  });
  if (!hasLock) {
    await Ledger.create({
      accountType: payout.payeeType,
      accountModel: payout.payeeType === 'vendor' ? 'Vendor' : 'User',
      accountId: payout.vendorId || payout.userId,
      sourceType: 'payout',
      sourceModel: 'Payout',
      sourceId: payout._id,
      direction: 'debit',
      amount: Number(payout.amount || 0),
      currency: 'NGN',
      status: 'available',
      releaseOn: null,
      reason: 'payout',
      meta: { payoutId: payout._id, kind: 'lock' },
    });
  }
}

async function reverseHoldIfAny(payout, note) {
  await Ledger.create({
    accountType: payout.payeeType,
    accountModel: payout.payeeType === 'vendor' ? 'Vendor' : 'User',
    accountId: payout.vendorId || payout.userId,
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payout._id,
    direction: 'credit',
    amount: Number(payout.amount || 0),
    currency: 'NGN',
    status: 'available',
    releaseOn: null,
    reason: 'adjustment',
    meta: { payoutId: payout._id, note: note || 'reverse_lock' },
  });
}

// PATCH /api/admin/payouts/:id/status
router.patch('/payouts/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const next = (req.body.status || '').toLowerCase();

    const allowed = ['submitted','requested','approved','processing','paid','failed','cancelled','rejected','pending'];
    if (!allowed.includes(next)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const doc = await Payout.findById(id);
    if (!doc) return res.status(404).json({ message: 'Payout not found' });

    // Enforce webhook-driven "paid"
    if (next === 'paid') {
      return res.status(400).json({ message: 'Set to "processing"; Paystack webhook will mark as paid automatically.' });
    }

    // Before moving to processing/paid, assert eligibility using EFFECTIVE availability
    if (next === 'processing' || next === 'paid') {
      await assertEligiblePayout(doc);
    }

    if (['failed','cancelled','rejected'].includes(next)) {
      await reverseHoldIfAny(doc, `payout_${next}`);
      doc.status = next;
      await doc.save();
      const updatedFail = await Payout.findById(id).lean();
      return res.json(updatedFail);
    }

    if (next === 'processing') {
      if (!PAYSTACK_SECRET) {
        return res.status(500).json({ message: 'Paystack not configured (PAYSTACK_SECRET_KEY missing)' });
      }

      // Lock funds (idempotent)
      await createHoldDebitIfMissing(doc);

      // If already has a transferRef, do not re-initiate; just keep processing
      if (!doc.transferRef) {
        try {
          // Resolve bank details
          const bank = await resolvePayeeBankForPayout(doc);
          if (!bank.accountNumber || !bank.accountName || !(bank.bankCode || bank.bankName)) {
            return res.status(400).json({ message: 'Bank details incomplete for this payout' });
          }
          const bankCode = bank.bankCode || await resolveBankCode(bank.bankName);
          if (!bankCode) {
            return res.status(400).json({ message: 'Unable to resolve bank code' });
          }

          // Create recipient + initiate transfer (idempotent reference)
          const recipient = await ensureRecipient({
            accountName: bank.accountName,
            accountNumber: bank.accountNumber,
            bankCode
          });

          const reference = `PAYOUT-${doc._id.toString()}`;
          const tx = await initiateTransfer({
            amountNaira: Number(doc.amount || 0),
            recipient_code: recipient.recipient_code,
            reason: `Payout ${doc._id.toString()} (${doc.payeeType})`,
            reference,
          });

          // Save transfer ref for webhook reconciliation
          doc.transferRef = tx?.initiated?.reference || tx?.initiated?.transfer_code || doc.transferRef;
          doc.provider = 'paystack';
          doc.meta = Object.assign({}, doc.meta || {}, {
            paystack: {
              recipient_code: recipient.recipient_code,
              initiated: tx.initiated || null,
              finalized: tx.finalized || null,
            }
          });
        } catch (e) {
          // Roll back lock and status if Paystack rejected
          await reverseHoldIfAny(doc, 'init_fail');
          doc.status = 'requested';
          await doc.save();

          if (e?.paystack) {
            const out = {
              message: e.paystack.message || 'Paystack validation error',
              code: e.paystack.code || null,
              type: e.paystack.type || null,
              meta: e.paystack.meta || null,
            };
            if (
              (out.code === 'missing_params' || out.type === 'validation_error') &&
              /phone number/i.test(out.message || '')
            ) {
              out.hint = 'Set your Business Phone Number in Paystack Dashboard → Settings → Compliance (Test Mode), then retry.';
            }
            return res.status(e.statusCode || 400).json(out);
          }

          return res.status(400).json({ message: e.message || 'Failed to initiate transfer' });
        }
      }

      doc.status = 'processing';
      await doc.save();

      const updated = await Payout.findById(id).lean();
      return res.json(updated);
    }

    // normalize pending-like states to a single stored value
    doc.status = (next === 'pending' || next === 'submitted') ? 'requested' : next;
    await doc.save();

    const updated = await Payout.findById(id).lean();
    res.json(updated);
  } catch (err) {
    console.error('Update payout status error:', err?.paystack || err?.response?.data || err.message || err);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      message: err?.paystack?.message || err.message || 'Failed to update payout',
      ...(err?.paystack ? { code: err.paystack.code, type: err.paystack.type, meta: err.paystack.meta } : {})
    });
  }
});

/* ======================
   CREATE MANUAL PAYOUT
   ====================== */
router.post('/payouts/manual', auth, async (req, res) => {
  try {
    const payeeType = (req.body.payeeType || '').toLowerCase();
    const payeeId = req.body.payeeId;
    const amount = Math.round(Number(req.body.amount || 0));
    if (!['vendor','user'].includes(payeeType)) {
      return res.status(400).json({ message: 'payeeType must be vendor or user' });
    }
    if (!payeeId || !mongoose.isValidObjectId(payeeId)) {
      return res.status(400).json({ message: 'Valid payeeId is required' });
    }
    if (!amount || amount < 1000) {
      return res.status(400).json({ message: 'Amount too small' });
    }

    const owner = payeeType === 'vendor'
      ? await Vendor.findById(payeeId).lean()
      : await User.findById(payeeId).lean();
    if (!owner) return res.status(404).json({ message: `${payeeType} not found` });

    // EFFECTIVE available (safe)
    const available = await getEffectiveAvailableBalance(payeeType, payeeId);
    if (amount > available) {
      return res.status(400).json({ message: `Amount exceeds available balance (₦${available.toLocaleString()})` });
    }

    const bank = {
      bankName: owner.bankName || owner.bank?.name,
      bankCode: owner.bankCode || owner.bank?.code,
      accountNumber: owner.accountNumber || owner.bank?.accountNumber,
      accountName: owner.accountName || owner.bank?.accountName,
    };

    const doc = await Payout.create({
      payeeType,
      vendorId: payeeType === 'vendor' ? payeeId : undefined,
      userId:   payeeType === 'user'   ? payeeId : undefined,
      amount,
      currency: 'NGN',
      status: 'requested',
      method: 'manual',
      requestedBy: req.user?._id,
      balanceAtRequest: available,
      bank,
      meta: { note: req.body.note || null, createdByAdmin: true },
    });

    await createHoldDebitIfMissing(doc);
    res.status(201).json(doc);
  } catch (err) {
    console.error('Manual payout error:', err);
    res.status(500).json({ message: 'Failed to create payout request' });
  }
});

/* ======================
   AUTO-SWEEP (batch to processing)
   ====================== */
router.post('/payouts/sweep', auth, async (req, res) => {
  try {
    const min = Math.max(Math.round(Number(req.body.min || 5000)), 1);
    const limit = Math.min(Math.max(parseInt(req.body.limit || '200', 10), 1), 1000);
    const rawType = (req.body.type || 'all').toLowerCase();
    const typeMatch = rawType === 'all' ? ['vendor','user'] : [rawType];

    const candidates = await Payout.aggregate([
      { $match: { payeeType: { $in: typeMatch }, status: { $in: ['submitted','requested','approved','pending'] } } },
      { $addFields: { amountNum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } } } },
      { $match: { amountNum: { $gte: min } } },
      { $sort: { createdAt: 1 } },
      { $limit: limit },
    ]);

    let moved = 0;
    let skipped = 0;

    for (const c of candidates) {
      const payout = await Payout.findById(c._id);
      if (!payout) { skipped++; continue; }
      try {
        await assertEligiblePayout(payout);           // EFFECTIVE guard
        await createHoldDebitIfMissing(payout);
        if (!payout.transferRef) {
          if (!PAYSTACK_SECRET) throw new Error('Paystack not configured');
          const bank = await resolvePayeeBankForPayout(payout);
          if (!bank.accountNumber || !bank.accountName || !(bank.bankCode || bank.bankName)) throw new Error('Bank details incomplete');
          const bankCode = bank.bankCode || await resolveBankCode(bank.bankName);
          if (!bankCode) throw new Error('Unable to resolve bank code');
          const recipient = await ensureRecipient({
            accountName: bank.accountName, accountNumber: bank.accountNumber, bankCode
          });
          const reference = `PAYOUT-${payout._id.toString()}`;
          const tx = await initiateTransfer({
            amountNaira: Number(payout.amount || 0),
            recipient_code: recipient.recipient_code,
            reason: `Payout ${payout._id.toString()} (${payout.payeeType})`,
            reference,
          });
          payout.transferRef = tx?.initiated?.reference || tx?.initiated?.transfer_code || payout.transferRef;
          payout.provider = 'paystack';
          payout.meta = Object.assign({}, payout.meta || {}, {
            paystack: {
              recipient_code: recipient.recipient_code,
              initiated: tx.initiated || null,
              finalized: tx.finalized || null,
            }
          });
        }
        payout.status = 'processing';
        await payout.save();
        moved++;
      } catch (e) {
        await reverseHoldIfAny(payout, 'sweep_init_fail');
        payout.status = 'requested';
        await payout.save();
        skipped++;
      }
    }

    res.json({ moved, skipped, total: candidates.length });
  } catch (err) {
    console.error('Auto-sweep error:', err);
    res.status(500).json({ message: 'Failed to sweep requests' });
  }
});

/* ======================
   BALANCES (effective)
   ====================== */
router.get('/payouts/balances', auth, async (req, res) => {
  try {
    const payeeType = (req.query.payeeType || 'vendor').toLowerCase();
    if (!['vendor','user'].includes(payeeType)) return res.json({ source: 'ledger', rows: [] });

    const map = await getEffectiveAvailableMap(payeeType);
    const entries = [...map.entries()].filter(([, amt]) => amt > 0);

    if (payeeType === 'vendor') {
      const vendors = await Vendor.find({ _id: { $in: entries.map(([id]) => id) } })
        .select('businessName name email')
        .lean();
      const vMap = new Map(vendors.map(v => [String(v._id), v]));
      const rows = entries.map(([id, amount]) => ({
        accountId: id,
        amount,
        name: vMap.get(id)?.businessName || vMap.get(id)?.name || 'Vendor',
        email: vMap.get(id)?.email || ''
      }));
      return res.json({ source: 'ledger_effective', rows });
    }

    // users
    const users = await User.find({ _id: { $in: entries.map(([id]) => id) } })
      .select('name email')
      .lean();
    const uMap = new Map(users.map(u => [String(u._id), u]));
    const rows = entries.map(([id, amount]) => ({
      accountId: id,
      amount,
      name: uMap.get(id)?.name || 'User',
      email: uMap.get(id)?.email || ''
    }));
    return res.json({ source: 'ledger_effective', rows });
  } catch (err) {
    console.error('balances error:', err);
    res.status(500).json({ message: 'Failed to load balances' });
  }
});

router.get('/payouts/available', auth, async (req, res) => {
  try {
    const payeeType = (req.query.payeeType || 'vendor').toLowerCase();
    if (!['vendor','user'].includes(payeeType)) return res.json({ source: 'ledger', rows: [] });

    const map = await getEffectiveAvailableMap(payeeType);
    const rows = [...map.entries()]
      .filter(([, amt]) => amt > 0)
      .map(([accountId, amount]) => ({ accountId, amount }));

    return res.json({ source: 'ledger_effective', rows });
  } catch (err) {
    console.error('payouts/available error:', err);
    return res.json({ source: 'ledger_effective', rows: [] });
  }
});

/* ======================
   EARNING ROWS
   ====================== */
router.get('/payouts/:payeeType/:id/rows', auth, async (req, res) => {
  try {
    const payeeType = (req.params.payeeType || '').toLowerCase();
    const id = req.params.id;
    if (!['vendor','user'].includes(payeeType) || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: 'Invalid params' });
    }

    const rows = await Ledger.aggregate([
      { $match: {
          accountType: payeeType,
          accountId: new mongoose.Types.ObjectId(id),
          ...(payeeType === 'vendor'
            ? { reason: 'vendor_share' }
            : {
                $or: [
                  { reason: { $in: USER_CREDIT_REASONS } },
                  { reason: CASHBACK_RE },
                  { reason: REF_OR_COMM_RE },
                  { 'meta.splitKind': { $in: ['cashback', 'referral'] } },
                ],
              }),
        }
      },
      { $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'b'
      } },
      { $addFields: { booking: { $first: '$b' } } },
      { $project: {
          _id: 0,
          amount: 1,
          status: 1,
          releaseOn: 1,
          reason: 1,
          checkInDate: '$booking.checkInDate',
          checkOutDate: '$booking.checkOutDate',
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({ rows });
  } catch (err) {
    console.error('earning rows error:', err);
    res.status(500).json({ message: 'Failed to load earning rows' });
  }
});

router.get('/payouts/earning-rows', auth, async (req, res) => {
  try {
    const accountType = (req.query.accountType || '').toLowerCase();
    const accountId = req.query.accountId;
    if (!['vendor','user'].includes(accountType) || !mongoose.isValidObjectId(accountId)) {
      return res.status(400).json({ message: 'Invalid params' });
    }

    const rows = await Ledger.aggregate([
      { $match: {
          accountType,
          accountId: new mongoose.Types.ObjectId(accountId),
          ...(accountType === 'vendor'
            ? { reason: 'vendor_share' }
            : {
                $or: [
                  { reason: { $in: USER_CREDIT_REASONS } },
                  { reason: CASHBACK_RE },
                  { reason: REF_OR_COMM_RE },
                  { 'meta.splitKind': { $in: ['cashback', 'referral'] } },
                ],
              }),
        }
      },
      { $lookup: {
          from: 'bookings',
          localField: 'bookingId',
          foreignField: '_id',
          as: 'b'
      } },
      { $addFields: { booking: { $first: '$b' } } },
      { $project: {
          _id: 0,
          amount: 1,
          status: 1,
          releaseOn: 1,
          reason: 1,
          checkInDate: '$booking.checkInDate',
          checkOutDate: '$booking.checkOutDate',
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    res.json({ rows });
  } catch (err) {
    console.error('earning-rows shim error:', err);
    res.status(500).json({ message: 'Failed to load earning rows' });
  }
});

module.exports = router;

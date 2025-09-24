// ✅ routes/userDashboard.js (full file)
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const axios = require('axios'); // ← for Paystack

const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');
const Payout = require('../models/payoutModel');

// ========== Config / Flags ==========
const MIN_PAYOUT_NGN = Number(process.env.MIN_PAYOUT_NGN || 5000);
const USER_PAYOUT_BANK_MANDATE = String(process.env.USER_PAYOUT_BANK_MANDATE || 'soft').toLowerCase();
const USER_RELEASE_HOURS = Number(process.env.USER_RELEASE_HOURS || 48);
const USER_SHOW_PARTNER_CARDS = String(process.env.USER_SHOW_PARTNER_CARDS || 'off').toLowerCase() === 'on';

// Paystack keys (required for bank list + resolution)
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET;

// Reason aliases we’ve seen in the wild
const CREDIT_REASONS = [
  'user_cashback',
  'cashback',
  'user_referral_commission',
  'referral_commission',
  'ref_commission'
];

const CASHBACK_RE = /cashback/i;
const REF_OR_COMM_RE = /(referral|commission)/i;
const REVERSAL_MARK_RE = /(cashback|referral|commission)/i;

// --- Small helpers ---
function oid(id) {
  return new mongoose.Types.ObjectId(String(id));
}

function getPartnerBanks() {
  try {
    const fromEnv = process.env.PARTNER_BANKS_JSON && JSON.parse(process.env.PARTNER_BANKS_JSON);
    if (Array.isArray(fromEnv) && fromEnv.length) return fromEnv;
  } catch (_) {}
  return [
    { name: 'Access Bank', cbnCode: '044', bankCode: '044', slug: 'access',   deepLinkBase: 'https://accessbankplc.com/?ref=hotelpennies' },
    { name: 'United Bank for Africa (UBA)', cbnCode: '033', bankCode: '033', slug: 'uba',      deepLinkBase: 'https://www.ubagroup.com/?ref=hotelpennies' },
    { name: 'Zenith Bank', cbnCode: '057', bankCode: '057', slug: 'zenith',   deepLinkBase: 'https://www.zenithbank.com/?ref=hotelpennies' },
    { name: 'Providus Bank', cbnCode: '101', bankCode: '101', slug: 'providus', deepLinkBase: 'https://providus.bank/?ref=hotelpennies' },
    { name: 'Kuda Microfinance Bank', bankCode: '090267', slug: 'kuda', deepLinkBase: 'https://kuda.com/?ref=hotelpennies' },
    { name: 'Moniepoint Microfinance Bank', bankCode: '090405', slug: 'moniepoint', deepLinkBase: 'https://moniepoint.com/?ref=hotelpennies' },
  ];
}

const mapUiStatus = (s) =>
  ['requested', 'approved', 'processing', 'pending'].includes(String(s).toLowerCase())
    ? 'pending'
    : ['rejected', 'cancelled', 'canceled', 'failed'].includes(String(s).toLowerCase())
    ? 'failed'
    : String(s || '').toLowerCase();

function normalizeName(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(mr|mrs|miss|ms|dr|chief|engr|sir)\b/g, '')
    .replace(/\band\b/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
function tokenSet(str) { return new Set(normalizeName(str).split(' ').filter(Boolean)); }
function namesClose(a, b) {
  const A = tokenSet(a), B = tokenSet(b);
  if (!A.size || !B.size) return false;
  const inter = new Set([...A].filter(x => B.has(x)));
  const score = inter.size / Math.max(A.size, B.size);
  return score >= 0.92;
}
function pickBankSnapshot(doc) {
  if (!doc || typeof doc !== 'object') return {};
  const snap = {
    bankName:      doc.bankName,
    bankCode:      doc.bankCode || doc.cbnCode,
    accountNumber: doc.accountNumber,
    accountName:   doc.accountName,
  };
  Object.keys(snap).forEach(k => { if (!snap[k]) delete snap[k]; });
  return snap;
}

// === Auth ===
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'user') {
      return res.status(403).json({ message: 'Access denied' });
    }
    const user = await User.findById(decoded.id).populate('referrals');
    if (!user) return res.status(404).json({ message: 'User not found' });
    req.user = user;
    req.userId = decoded.id;
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// === “Effective status” helpers (48h window) ===
function classifyCredit(doc) {
  const split = String(doc?.meta?.splitKind || '').toLowerCase();
  if (split === 'cashback') return 'cashback';
  if (split === 'referral') return 'commission';
  const reason = String(doc?.reason || '');
  if (CASHBACK_RE.test(reason)) return 'cashback';
  if (REF_OR_COMM_RE.test(reason)) return 'commission';
  return 'other';
}

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
            { status: { $in: ['pending', 'hold', 'locked'] } },
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
  } else if (desiredStatus === 'pending') {
    if (match.status) delete match.status;
    match.$and = (match.$and || []).concat([{
      $and: [
        { status: { $in: ['pending', 'hold', 'locked'] } },
        {
          $or: [
            { releaseOn: { $gt: now } },
            { releaseOn: { $exists: false } },
            { createdAt: { $gt: new Date(now.getTime() - releaseMs) } },
          ]
        }
      ]
    }]);
  }
}

async function findUserCredits({ userId, status = null, startDate = null, endDate = null }) {
  const match = {
    accountType: 'user',
    accountId: oid(userId),
    direction: 'credit',
    $or: [
      { reason: { $in: CREDIT_REASONS } },
      { reason: CASHBACK_RE },
      { reason: REF_OR_COMM_RE },
      { 'meta.splitKind': { $in: ['cashback', 'referral'] } },
    ],
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lt = new Date(endDate);
  }
  if (status === 'available' || status === 'pending') {
    applyEffectiveStatus(match, status);
  } else if (status) {
    match.status = status;
  }
  return Ledger.find(match)
    .select('amount status reason createdAt releaseOn meta.splitKind meta.category')
    .lean();
}

async function findUserDebits({ userId, status = null, includePayout = true, startDate = null, endDate = null }) {
  const ors = [
    { reason: { $in: CREDIT_REASONS } },
    { reason: CASHBACK_RE },
    { reason: REF_OR_COMM_RE },
    { $and: [{ reason: 'adjustment' }, { $or: [{ 'meta.kind': REVERSAL_MARK_RE }, { 'meta.subtype': REVERSAL_MARK_RE }] }] },
  ];
  if (includePayout) ors.push({ reason: 'payout' });

  const match = {
    accountType: 'user',
    accountId: oid(userId),
    direction: 'debit',
    $or: ors,
  };

  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lt = new Date(endDate);
  }

  if (status === 'available' || status === 'pending') {
    applyEffectiveStatus(match, status);
  } else if (status) {
    match.status = status;
  }

  return Ledger.find(match).select('amount status reason createdAt releaseOn meta.kind meta.subtype').lean();
}

function sumAmounts(rows) {
  return rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
}

async function getAvailableBalanceUser(userId) {
  const [credits, debitsRaw] = await Promise.all([
    findUserCredits({ userId, status: 'available' }),
    findUserDebits({ userId, status: 'available', includePayout: true }),
  ]);

  // ✅ Do NOT subtract adjustment debits (they are just the audit mirror of reversals)
  const debits = debitsRaw.filter(r => String(r.reason || '') !== 'adjustment');

  // Optional safety: prevent tiny negatives from rounding
  return Math.max(0, sumAmounts(credits) - sumAmounts(debits));
}


async function getPendingBalanceUser(userId) {
  const [credits, debits] = await Promise.all([
    findUserCredits({ userId, status: 'pending' }),
    findUserDebits({ userId, status: 'pending', includePayout: false }),
  ]);
  return sumAmounts(credits) - sumAmounts(debits);
}

// === Locked account resolver (reads both trees, supports lean or doc) ===
function resolveLockedAccount(userLike) {
  const u = userLike?.toObject ? userLike.toObject() : userLike || {};
  const list = Array.isArray(u.payoutAccounts) && u.payoutAccounts.length
    ? u.payoutAccounts
    : (u.payoutStatus && Array.isArray(u.payoutStatus.payoutAccounts) ? u.payoutStatus.payoutAccounts : []);

  let idx = null;
  if (typeof u.lockedPayoutAccountIndex === 'number') idx = u.lockedPayoutAccountIndex;
  else if (typeof u?.payoutStatus?.lockedPayoutAccountIndex === 'number') idx = u.payoutStatus.lockedPayoutAccountIndex;

  if (idx !== null && list[idx]) return { account: list[idx], index: idx, list };

  if (list.length === 1) return { account: list[0], index: 0, list };

  return { account: null, index: null, list };
}

// Earnings breakdown helper
async function getEarningBreakdown(userId, startDate = null, endDate = null) {
  const [creditRows, debitRows] = await Promise.all([
    findUserCredits({ userId, startDate, endDate }),
    findUserDebits({ userId, includePayout: false, startDate, endDate }),
  ]);

  const out = {
    cashback:   { gross: 0, reversed: 0, net: 0 },
    commission: { gross: 0, reversed: 0, net: 0 },
  };

  for (const row of creditRows) {
    const kind = classifyCredit(row);
    if (kind === 'cashback') out.cashback.gross += Number(row.amount || 0);
    else if (kind === 'commission') out.commission.gross += Number(row.amount || 0);
  }

  for (const row of debitRows) {
    const reason  = String(row.reason || '');
    const kindStr = `${reason} ${row?.meta?.kind || ''} ${row?.meta?.subtype || ''}`;
    if (CASHBACK_RE.test(kindStr)) out.cashback.reversed += Number(row.amount || 0);
    else if (REF_OR_COMM_RE.test(kindStr)) out.commission.reversed += Number(row.amount || 0);
  }

  out.cashback.net   = out.cashback.gross   - out.cashback.reversed;
  out.commission.net = out.commission.gross - out.commission.reversed;
  return out;
}

/* ======================
   Paystack: banks + resolver (cached)
   ====================== */
const BANKS_TTL_MS = (Number(process.env.BANKS_CACHE_TTL_MIN || 1440) || 1440) * 60 * 1000; // default 24h
let BANKS_CACHE = { at: 0, list: [] };

function aliasBankDisplayName(name = '') {
  const n = String(name).toLowerCase();
  // Ensure user sees OPay consistently even if Paystack returns "Paycom" or variant
  if (n.includes('opay') || n.includes('paycom')) return 'OPay (Paycom)';
  return name;
}

async function fetchBanksFromPaystack() {
  if (!PAYSTACK_SECRET) {
    throw new Error('Paystack not configured (PAYSTACK_SECRET_KEY missing)');
  }
  const { data } = await axios.get('https://api.paystack.co/bank', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    params: { currency: 'NGN' },
  });
  const raw = Array.isArray(data?.data) ? data.data : [];
  // Keep only fields we need; apply alias for OPay/Paycom
  return raw.map(b => ({
    name: aliasBankDisplayName(b.name || ''),
    code: String(b.code || '').trim(),
  })).filter(b => b.code);
}

async function getBanksCached() {
  const now = Date.now();
  if (BANKS_CACHE.list.length && now - BANKS_CACHE.at < BANKS_TTL_MS) {
    return BANKS_CACHE.list;
  }
  const list = await fetchBanksFromPaystack();
  BANKS_CACHE = { at: now, list };
  return list;
}

async function resolveAccount({ accountNumber, bankCode }) {
  if (!PAYSTACK_SECRET) {
    throw new Error('Paystack not configured (PAYSTACK_SECRET_KEY missing)');
  }
  const { data } = await axios.get('https://api.paystack.co/bank/resolve', {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    params: { account_number: accountNumber, bank_code: bankCode },
  });
  const resp = data?.data || {};
  return {
    accountName: resp.account_name || '',
    accountNumber: resp.account_number || accountNumber,
    bankCode,
  };
}

/* ======================
   Routes
   ====================== */

// Canonical bank list for the UI (auth required)
router.get('/banks', auth, async (req, res) => {
  try {
    const banks = await getBanksCached();
    res.json({ banks });
  } catch (e) {
    console.error('banks error:', e?.response?.data || e.message || e);
    res.status(500).json({ message: 'Failed to load banks' });
  }
});

// Resolve bank account number → name (auth required)
router.post('/banks/resolve', auth, async (req, res) => {
  try {
    const { accountNumber, bankCode } = req.body || {};
    if (!/^\d{10}$/.test(String(accountNumber || ''))) {
      return res.status(400).json({ message: 'accountNumber must be 10 digits' });
    }
    if (!bankCode) {
      return res.status(400).json({ message: 'bankCode is required' });
    }
    const out = await resolveAccount({ accountNumber, bankCode });
    if (!out.accountName) {
      return res.status(400).json({ message: 'Unable to resolve account name' });
    }
    res.json(out);
  } catch (e) {
    const msg = e?.response?.data?.message || e.message || 'Failed to resolve account';
    res.status(400).json({ message: msg });
  }
});

// ========== Routes ==========

// Dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const user = req.user;
    const now = new Date();

    const [currentBalance, payableBalance] = await Promise.all([
      getPendingBalanceUser(user._id),
      getAvailableBalanceUser(user._id),
    ]);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [allBreakdowns, monthBreakdowns] = await Promise.all([
      getEarningBreakdown(user._id),
      getEarningBreakdown(user._id, monthStart, nextMonth),
    ]);

    const cashbackEarned   = allBreakdowns.cashback.net;
    const commissionEarned = allBreakdowns.commission.net;
    const monthlyEarnings  = monthBreakdowns.cashback.net + monthBreakdowns.commission.net;

    const referralCount = new Set(user.referredEmails || []).size;

    const referralDetails = (user.referrals || []).map(r => ({
      name: r.name,
      email: r.email,
      isEmailVerified: r.isEmailVerified,
      totalSpent: r.totalSpent || 0,
      referredAt: r.createdAt
    }));

    const payouts = await Payout.find({ payeeType: 'user', userId: user._id })
      .select('amount currency status transferRef createdAt provider method')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const payoutHistory = payouts.map(p => ({
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      uiStatus: mapUiStatus(p.status),
      transferRef: p.transferRef || null,
      provider: p.provider || null,
      method: p.method || null,
      createdAt: p.createdAt,
    }));

    const firstPayoutHoldUntil = user.payoutStatus?.firstPayoutHoldUntil || null;
    const firstPayoutHoldActive = firstPayoutHoldUntil ? new Date(firstPayoutHoldUntil) > now : false;

    const { index: lockedIdx, list: payoutAccounts } = resolveLockedAccount(user);

    const payload = {
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      address: user.address || '',
      userCode: user.userCode,
      affiliateLink: user.affiliateLink,

      totalEarned: user.payoutStatus?.totalEarned || 0,
      currentBalance,
      payableBalance,
      minPayout: MIN_PAYOUT_NGN,

      monthlyEarnings,
      commissionEarned,
      cashbackEarned,
      breakdowns: allBreakdowns,

      referralCount,
      referralDetails,

      isEmailVerified: user.isEmailVerified,
      payoutEligible: payableBalance >= MIN_PAYOUT_NGN,

      linkedAccountId: user.payoutStatus?.linkedAccountId || null,
      isFirstPayoutHandled: user.payoutStatus?.isFirstPayoutHandled || false,
      firstPayoutHoldUntil,
      firstPayoutHoldActive,

      payoutHistory,

      bankMandate: USER_PAYOUT_BANK_MANDATE,
      partnerBanks: USER_SHOW_PARTNER_CARDS ? getPartnerBanks() : [],

      // expose for UI
      lockedPayoutAccountIndex: typeof lockedIdx === 'number' ? lockedIdx : null,
      payoutAccounts,
    };

    res.json(payload);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Could not load dashboard' });
  }
});

// Profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      user: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        userCode: user.userCode,
        affiliateLink: user.affiliateLink,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load profile' });
  }
});

// Update profile
router.put('/update', auth, async (req, res) => {
  try {
    const { name, email, phone, address } = req.body;
    const user = await User.findById(req.userId);
    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.address = address || user.address;
    await user.save();
    res.status(200).json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Referrals (robust)
router.get('/referrals', auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId).populate('referrals', 'name email createdAt').lean();
    let refs = Array.isArray(me?.referrals) ? me.referrals : [];

    if (!refs.length) {
      refs = await User.find({ referredBy: req.userId })
        .select('name email createdAt')
        .lean();
    }

    if (!refs.length && Array.isArray(me?.referredEmails)) {
      refs = me.referredEmails.map((email) => ({ name: '', email, createdAt: null }));
    }

    res.json({ referrals: refs });
  } catch (err) {
    console.error('Referrals error:', err);
    res.status(500).json({ message: 'Could not load referrals' });
  }
});

// Referral conversions (ledger)
router.get('/referral-conversions', auth, async (req, res) => {
  try {
    const rows = await Ledger.find({
      accountType: 'user',
      accountId: req.userId,
      direction: 'credit',
      $or: [
        { reason: { $in: ['user_referral_commission', 'referral_commission', 'ref_commission'] } },
        { 'meta.splitKind': 'referral' },
        { reason: REF_OR_COMM_RE },
      ],
    })
      .select('amount createdAt bookingId meta')
      .sort({ createdAt: -1 })
      .lean();

    const conversions = rows.map((r) => ({
      referralId: r?.meta?.referralId || r?.meta?.refId || null,
      bookingId: r?.bookingId || r?.meta?.bookingId || null,
      amountEarned: Number(r.amount || 0),
      date: r.createdAt,
    }));

    res.json({ conversions });
  } catch (err) {
    console.error('Referral conversions error:', err);
    res.status(500).json({ message: 'Failed to load referral conversions' });
  }
});

// ✅ PAGINATED payout history
router.get('/payout-history', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '20', 10), 1), 100);
    const status = String(req.query.status || 'all').toLowerCase();

    let statusFilter = {};
    if (status !== 'all') {
      if (status === 'pending') {
        statusFilter = { status: { $in: ['requested','approved','processing','pending'] } };
      } else if (status === 'failed') {
        statusFilter = { status: { $in: ['failed','rejected','cancelled','canceled'] } };
      } else if (status === 'paid') {
        statusFilter = { status: 'paid' };
      }
    }

    const baseFilter = { payeeType: 'user', userId: req.userId, ...statusFilter };

    const [total, rows] = await Promise.all([
      Payout.countDocuments(baseFilter),
      Payout.find(baseFilter)
        .select('amount currency status transferRef createdAt provider method')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    let payouts = rows.map((p) => ({
      amount: p.amount,
      currency: p.currency,
      status: p.status,
      uiStatus: mapUiStatus(p.status),
      transferRef: p.transferRef || null,
      provider: p.provider || null,
      method: p.method || null,
      createdAt: p.createdAt,
    }));

    if (total === 0) {
      const user = await User.findById(req.userId).lean();
      const legacy = Array.isArray(user?.payoutHistory) ? user.payoutHistory : [];
      payouts = legacy
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
        .slice((page - 1) * pageSize, page * pageSize)
        .map((p) => ({
          amount: Number(p.amount || 0),
          currency: 'NGN',
          status: p.status || 'pending',
          uiStatus: mapUiStatus(p.status || 'pending'),
          transferRef: p.transferRef || null,
          provider: p.provider || null,
          method: p.method || 'manual',
          createdAt: p.createdAt || p.date || new Date(),
        }));
      return res.json({
        payouts,
        page,
        pageSize,
        total: legacy.length,
        totalPages: Math.ceil(legacy.length / pageSize) || 1,
        source: 'legacy',
      });
    }

    res.json({
      payouts,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize) || 1,
      source: 'payouts_collection',
    });
  } catch (err) {
    console.error('Payout history error:', err);
    res.status(500).json({ message: 'Failed to fetch payout history' });
  }
});

// ===== Payout accounts CRUD (persist both locations, strict:false, lean reads) =====
router.get('/payout-accounts', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    const list = Array.isArray(user?.payoutAccounts) && user.payoutAccounts.length
      ? user.payoutAccounts
      : (user?.payoutStatus?.payoutAccounts || []);
    const { index: lockedIdx } = resolveLockedAccount(user);
    res.json({
      payoutAccounts: list,
      accounts: list, // compatibility
      lockedPayoutAccountIndex: typeof lockedIdx === 'number' ? lockedIdx : null,
      partnerBanks: USER_SHOW_PARTNER_CARDS ? getPartnerBanks() : [],
      bankMandate: USER_PAYOUT_BANK_MANDATE,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load payout accounts' });
  }
});

router.put('/payout-accounts', auth, async (req, res) => {
  try {
    const list = Array.isArray(req.body?.accounts)
      ? req.body.accounts
      : Array.isArray(req.body?.payoutAccounts)
      ? req.body.payoutAccounts
      : null;

    if (!Array.isArray(list)) {
      return res.status(400).json({ message: 'accounts must be an array' });
    }

    if (USER_PAYOUT_BANK_MANDATE === 'on') {
      const allowed = new Set(getPartnerBanks().map(b => b.bankCode));
      for (const acc of list) {
        if (acc?.bankCode && !allowed.has(String(acc.bankCode))) {
          return res.status(400).json({ message: 'Selected bank is not a partner bank' });
        }
      }
    }

    const normalized = list.map(a => ({
      bankName: a.bankName,
      bankCode: a.bankCode || a.cbnCode || '',
      accountNumber: a.accountNumber,
      accountName: a.accountName,
    }));

    // ✅ write to both trees with strict:false
    await User.updateOne(
      { _id: req.userId },
      {
        $set: {
          payoutAccounts: normalized,
          'payoutStatus.payoutAccounts': normalized,
        },
      },
      { strict: false }
    );

    const user = await User.findById(req.userId).lean();
    const { index: lockedIdx } = resolveLockedAccount(user);

    res.json({
      payoutAccounts: normalized,
      accounts: normalized,
      lockedPayoutAccountIndex: typeof lockedIdx === 'number' ? lockedIdx : null,
    });
  } catch (err) {
    console.error('Update payout accounts error:', err);
    res.status(500).json({ message: 'Failed to update payout accounts' });
  }
});

router.post('/lock-payout-account', auth, async (req, res) => {
  try {
    const { index } = req.body;
    const user = await User.findById(req.userId).lean();
    const list = Array.isArray(user?.payoutAccounts) && user.payoutAccounts.length
      ? user.payoutAccounts
      : (user?.payoutStatus?.payoutAccounts || []);

    if (!Array.isArray(list) || index < 0 || index >= list.length) {
      return res.status(400).json({ message: 'Invalid index' });
    }

    if (USER_PAYOUT_BANK_MANDATE === 'on') {
      const allowed = new Set(getPartnerBanks().map(b => b.bankCode));
      const acc = list[index];
      if (acc?.bankCode && !allowed.has(String(acc.bankCode))) {
        return res.status(400).json({ message: 'Selected bank is not a partner bank' });
      }
    }

    // ✅ persist lock both places
    await User.updateOne(
      { _id: req.userId },
      {
        $set: {
          lockedPayoutAccountIndex: index,
          'payoutStatus.lockedPayoutAccountIndex': index,
        },
      },
      { strict: false }
    );

    res.json({
      payoutAccounts: list,
      lockedPayoutAccountIndex: index,
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to lock payout account' });
  }
});

// Name validation (profile ↔ account name)
router.post('/validate-account-name', auth, async (req, res) => {
  try {
    const { accountName } = req.body;
    if (!accountName) return res.status(400).json({ ok: false, message: 'accountName is required' });

    const profileName = req.user?.name || '';
    const ok = namesClose(profileName, accountName);
    res.json({
      ok,
      normalizedProfile: normalizeName(profileName),
      normalizedAccount: normalizeName(accountName),
      rule: 'token-match >= 0.92; titles/diacritics/spacing ignored',
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Name validation failed' });
  }
});

// Request payout
router.post('/request-payout', auth, async (req, res) => {
  try {
    const { amount } = req.body;
    const user = await User.findById(req.userId).lean();

    const payable = await getAvailableBalanceUser(req.userId);

    let amt = Math.round(Number(amount));
    if (!Number.isFinite(amt) || amt <= 0) {
      amt = Math.round(Number(payable) || 0);
    }
    if (!amt || amt < MIN_PAYOUT_NGN) {
      return res.status(400).json({ message: `Payable amount must be ₦${MIN_PAYOUT_NGN.toLocaleString()} or more` });
    }
    if (amt > payable) {
      return res.status(400).json({ message: 'Cannot request more than payable balance' });
    }

    const { account: locked } = resolveLockedAccount(user);
    if (!locked) {
      return res.status(400).json({ message: 'Please add and lock a payout account first' });
    }

    if (USER_PAYOUT_BANK_MANDATE === 'on') {
      const allowed = new Set(getPartnerBanks().map(b => b.bankCode));
      if (locked.bankCode && !allowed.has(String(locked.bankCode))) {
        return res.status(400).json({ message: 'Selected bank is not a partner bank' });
      }
    }

    const holdUntil = user?.payoutStatus?.firstPayoutHoldUntil ? new Date(user.payoutStatus.firstPayoutHoldUntil) : null;
    if (holdUntil && holdUntil > new Date()) {
      return res.status(400).json({ message: `Your first payout unlocks on ${holdUntil.toLocaleString()}` });
    }

    const bankSnapshot = pickBankSnapshot(locked);

    const doc = await Payout.create({
      payeeType: 'user',
      userId: user._id,
      amount: amt,
      currency: 'NGN',
      status: 'requested',
      method: 'manual',
      requestedBy: user._id,
      balanceAtRequest: payable,
      bank: bankSnapshot,
      meta: { source: 'user_dashboard' },
    });

    await Ledger.create({
      accountType: 'user',
      accountModel: 'User',
      accountId: user._id,
      sourceType: 'payout',
      sourceModel: 'Payout',
      sourceId: doc._id,
      direction: 'debit',
      amount: amt,
      currency: 'NGN',
      status: 'available',
      releaseOn: null,
      reason: 'payout',
      meta: { payoutId: doc._id, kind: 'lock' },
    });

    // mark first payout handled
    await User.updateOne(
      { _id: user._id },
      { $set: { 'payoutStatus.isFirstPayoutHandled': true } },
      { strict: false }
    );

    res.status(200).json({ message: 'Payout requested successfully', payoutId: doc._id });
  } catch (err) {
    console.error('Request payout error:', err);
    res.status(500).json({ message: 'Failed to process payout' });
  }
});

// Delete account
router.delete('/delete', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Account deletion error:', err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

// Referral code lookup
router.get('/code/:code', async (req, res) => {
  try {
    const user = await User.findOne({ userCode: req.params.code }).lean();
    if (!user) return res.status(404).json({ message: 'Invalid referral code' });
    res.status(200).json({ userId: user._id });
  } catch (err) {
    console.error('Referral code lookup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

// âœ… routes/payoutRequestRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

const mongoose = require('mongoose');
const Payout = require('../models/payoutModel');
const Ledger = require('../models/ledgerModel');
const Vendor = require('../models/vendorModel');
const User = require('../models/userModel');

// ---- config / constants ----
const MIN_PAYOUT_NGN = Number(process.env.MIN_PAYOUT_NGN || 5000);
const ACTIVE_PAYOUT_STATUSES = ['requested', 'processing'];

// ---- helpers ----
async function getAvailableBalance(accountType, idStr) {
  const accountId = new mongoose.Types.ObjectId(idStr);
  const rows = await Ledger.aggregate([
    { $match: { accountType, accountId, status: 'available' } },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
        debits:  { $sum: { $cond: [{ $eq: ['$direction', 'debit']  }, '$amount', 0] } },
      },
    },
  ]);
  const r = rows[0] || { credits: 0, debits: 0 };
  return (r.credits || 0) - (r.debits || 0); // NGN major units
}

function pickBankSnapshot(doc) {
  if (!doc || typeof doc !== 'object') return {};
  const fromFlat = {
    bankName:      doc.bankName || doc.bank?.name || doc.bank_details?.bank_name,
    bankCode:      doc.bankCode || doc.bank?.code || doc.bank_details?.bank_code,
    accountNumber: doc.accountNumber || doc.bank?.accountNumber || doc.bank_details?.account_number,
    accountName:   doc.accountName || doc.bank?.accountName || doc.bank_details?.account_name,
  };
  Object.keys(fromFlat).forEach(k => { if (!fromFlat[k]) delete fromFlat[k]; });
  return fromFlat;
}

// Normalize who is calling and which payee they are
function resolvePayeeFromAuth(req, requestedPayeeType, bodyPayeeId) {
  const role = req.user?.role;
  // Admin can override explicitly
  if (role === 'admin') {
    if (!['vendor', 'user'].includes(requestedPayeeType)) {
      throw Object.assign(new Error('payeeType must be vendor or user'), { status: 400 });
    }
    if (!bodyPayeeId || !mongoose.isValidObjectId(bodyPayeeId)) {
      throw Object.assign(new Error('Valid payeeId is required for admin requests'), { status: 400 });
    }
    return { payeeType: requestedPayeeType, payeeId: bodyPayeeId, actorRole: role };
  }

  // Self-service
  if (role === 'vendor') {
    if (requestedPayeeType && requestedPayeeType !== 'vendor') {
      throw Object.assign(new Error('Vendors can only request payouts for vendor accounts'), { status: 403 });
    }
    return { payeeType: 'vendor', payeeId: req.user.vendorId || req.user._id, actorRole: role };
  }
  if (role === 'user') {
    if (requestedPayeeType && requestedPayeeType !== 'user') {
      throw Object.assign(new Error('Users can only request payouts for their own user account'), { status: 403 });
    }
    return { payeeType: 'user', payeeId: req.user._id, actorRole: role };
  }

  throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

function parseAmountNaira(raw, fallbackAll) {
  if (raw === undefined || raw === null || raw === '' || String(raw).toLowerCase() === 'all') {
    return Number(fallbackAll); // may be 0
  }
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) {
    throw Object.assign(new Error('Invalid amount'), { status: 400 });
  }
  return n;
}

async function getOnHoldAmount(payeeType, payeeId) {
  const match = { payeeType, status: { $in: ACTIVE_PAYOUT_STATUSES } };
  if (payeeType === 'vendor') match.vendorId = new mongoose.Types.ObjectId(payeeId);
  if (payeeType === 'user')   match.userId   = new mongoose.Types.ObjectId(payeeId);

  const rows = await Payout.aggregate([
    { $match: match },
    { $group: { _id: null, amount: { $sum: '$amount' } } },
  ]);
  return rows[0]?.amount || 0; // NGN major units
}

async function hasActiveRequest(payeeType, payeeId) {
  const q = { payeeType, status: { $in: ACTIVE_PAYOUT_STATUSES } };
  if (payeeType === 'vendor') q.vendorId = payeeId;
  if (payeeType === 'user')   q.userId   = payeeId;
  const count = await Payout.countDocuments(q);
  return count > 0;
}

// ---- core handler: POST /api/payouts/request ----
router.post('/request', auth, async (req, res) => {
  let session;
  try {
    const requestedPayeeType = (req.body.payeeType || '').toLowerCase();
    const { payeeType, payeeId, actorRole } = resolvePayeeFromAuth(
      req,
      requestedPayeeType,
      req.body.payeeId
    );

    // Find payee + bank snapshot
    let snapshot = {};
    if (payeeType === 'vendor') {
      const v = await Vendor.findById(payeeId).lean();
      if (!v) return res.status(404).json({ message: 'Vendor not found' });
      snapshot = pickBankSnapshot(v);
    } else {
      const u = await User.findById(payeeId).lean();
      if (!u) return res.status(404).json({ message: 'User not found' });
      snapshot = pickBankSnapshot(u);
    }

    // Balances
    const available = await getAvailableBalance(payeeType, payeeId);
    const amount = parseAmountNaira(req.body.amount, available);

    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'No payable balance available' });
    }
    if (amount < MIN_PAYOUT_NGN) {
      return res.status(400).json({ message: `Minimum payout is â‚¦${MIN_PAYOUT_NGN.toLocaleString()}` });
    }
    if (amount > available) {
      return res.status(400).json({ message: `Amount exceeds available balance (â‚¦${available.toLocaleString()})` });
    }
    if (await hasActiveRequest(payeeType, payeeId)) {
      return res.status(409).json({ message: 'You already have a pending payout (requested/processing).' });
    }

    // Atomic: create payout + lock funds
    session = await mongoose.startSession();
    session.startTransaction();

    const payoutDocArr = await Payout.create(
      [
        {
          payeeType,
          vendorId: payeeType === 'vendor' ? payeeId : undefined,
          userId:   payeeType === 'user'   ? payeeId : undefined,
          amount,
          currency: 'NGN',
          status: 'requested',
          method: 'manual',
          requestedBy: req.user?._id,
          balanceAtRequest: available,
          bank: snapshot,
          meta: { note: req.body.note || null, actorRole },
        },
      ],
      { session }
    );
    const payoutDoc = payoutDocArr[0];

    await Ledger.create(
      [
        {
          accountType: payeeType,                // 'vendor' | 'user'
          accountModel: payeeType === 'vendor' ? 'Vendor' : 'User',
          accountId: payeeId,
          sourceType: 'payout',
          sourceModel: 'Payout',
          sourceId: payoutDoc._id,
          direction: 'debit',
          amount,
          currency: 'NGN',
          status: 'available',                   // reduce available now (lock)
          releaseOn: null,
          reason: 'payout',
          meta: { payoutId: payoutDoc._id, kind: 'lock' },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Return updated balances
    const [newAvailable, onHold] = await Promise.all([
      getAvailableBalance(payeeType, payeeId),
      getOnHoldAmount(payeeType, payeeId),
    ]);

    return res.status(201).json({
      message: 'Payout request submitted',
      payout: payoutDoc,
      balances: {
        available: newAvailable,          // already net of the lock
        onHold,                           // sum(requested+processing)
        payableBalance: newAvailable,     // UI can use this as vendorStats.payableBalance
      },
    });
  } catch (err) {
    if (session) {
      try { await session.abortTransaction(); } catch (_) {}
      session.endSession();
    }
    const code = err.status || 500;
    console.error('Create payout request error:', err);
    res.status(code).json({ message: err.message || 'Failed to create payout request' });
  }
});

// ---- GET /api/payouts/me  (history + balances for the signed-in actor) ----
router.get('/me', auth, async (req, res) => {
  try {
    const role = req.user?.role;
    if (!['vendor', 'user', 'admin'].includes(role)) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Admin can pass ?payeeType=&payeeId= to inspect; others are self only.
    let payeeType, payeeId;
    if (role === 'admin' && req.query.payeeType && req.query.payeeId) {
      payeeType = String(req.query.payeeType).toLowerCase();
      payeeId = req.query.payeeId;
      if (!['vendor', 'user'].includes(payeeType) || !mongoose.isValidObjectId(payeeId)) {
        return res.status(400).json({ message: 'Invalid payeeType or payeeId' });
      }
    } else if (role === 'vendor') {
      payeeType = 'vendor';
      payeeId = req.user.vendorId || req.user._id;
    } else {
      payeeType = 'user';
      payeeId = req.user._id;
    }

    const [available, payouts] = await Promise.all([
      getAvailableBalance(payeeType, payeeId),
      Payout.find(
        payeeType === 'vendor'
          ? { payeeType, vendorId: payeeId }
          : { payeeType, userId: payeeId }
      )
        .sort({ createdAt: -1 })
        .limit(200),
    ]);

    const ACTIVE_PAYOUT_STATUSES = ['requested', 'processing'];
    const onHold = payouts
      .filter(p => ACTIVE_PAYOUT_STATUSES.includes(p.status))
      .reduce((s, p) => s + (p.amount || 0), 0);

    return res.json({
      payeeType,
      payeeId,
      balances: {
        available,
        onHold,
        payableBalance: available, // available is already net of payout locks in your ledger
      },
      payouts,
      minPayout: MIN_PAYOUT_NGN, // << âœ… expose minimum payout (NGN, major units)
      currency: 'NGN',
    });
  } catch (err) {
    console.error('Fetch self payouts error:', err);
    res.status(500).json({ message: 'Failed to load payouts' });
  }
});

module.exports = router;


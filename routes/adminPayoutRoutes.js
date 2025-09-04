'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const User = require('../models/userModel');
const Payout = require('../models/payoutModel');
const Ledger = require('../models/ledgerModel');

const auth = require('../middleware/adminAuth');
const { ensureRecipient, initiateTransfer } = require('../services/payments/paystack');

// Minimum payout threshold in NGN (naira)
const MIN_PAYOUT_NGN = Number(process.env.MIN_PAYOUT_NGN || 5000);

/* ---------------- helpers ---------------- */

/**
 * Compute available balance from the ledger for a given account.
 * Assumes Ledger amounts are stored in NGN (same unit as Payout.amount here).
 */
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
  return (r.credits || 0) - (r.debits || 0);
}

/**
 * Pick the user's locked payout account snapshot (bank details).
 */
function pickLockedUserBankSnapshot(user) {
  const idx = Number.isInteger(user?.lockedPayoutAccountIndex) ? user.lockedPayoutAccountIndex : -1;
  const arr = Array.isArray(user?.payoutAccounts) ? user.payoutAccounts : [];
  const acc = idx >= 0 && idx < arr.length ? arr[idx] : null;
  if (!acc) return null;

  const bankCode = acc.bankCode || acc.cbnCode || null;
  const snap = {
    bankName: acc.bankName,
    bankCode,
    accountNumber: acc.accountNumber,
    accountName: acc.accountName,
  };
  // prune empties
  Object.keys(snap).forEach((k) => { if (!snap[k]) delete snap[k]; });
  return snap;
}

/**
 * Create a hold (debit) on the ledger for this payout if missing.
 * Idempotent by (sourceModel, sourceId, direction, reason).
 */
async function createHoldDebitIfMissing(payout, session) {
  const exists = await Ledger.exists({
    accountType: 'user',
    accountId: payout.userId,
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payout._id,
    direction: 'debit',
    reason: 'payout',
    status: 'available',
  }).session(session);

  if (!exists) {
    await Ledger.create([{
      accountType: 'user',
      accountModel: 'User',
      accountId: payout.userId,
      sourceType: 'payout',
      sourceModel: 'Payout',
      sourceId: payout._id,
      direction: 'debit',
      amount: Number(payout.amount || 0), // NGN
      currency: 'NGN',
      status: 'available', // lock immediately
      releaseOn: null,
      reason: 'payout',
      meta: { payoutId: payout._id, kind: 'lock' },
    }], { session });
  }
}

/**
 * One-time reversal credit to undo the lock if transfer init fails.
 * Guarded with an exists check to avoid duplicates on retries.
 * (Consider adding a unique index in Ledger to enforce single reversal.)
 */
async function reverseHoldIfAny(payout, note) {
  const exists = await Ledger.exists({
    accountType: 'user',
    accountId: payout.userId,
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payout._id,
    direction: 'credit',
    reason: 'adjustment',
    'meta.note': 'init_fail',
  });
  if (exists) return;

  await Ledger.create({
    accountType: 'user',
    accountModel: 'User',
    accountId: payout.userId,
    sourceType: 'payout',
    sourceModel: 'Payout',
    sourceId: payout._id,
    direction: 'credit',
    amount: Number(payout.amount || 0), // NGN
    currency: 'NGN',
    status: 'available',
    releaseOn: null,
    reason: 'adjustment',
    meta: { payoutId: payout._id, note: note || 'init_fail' },
  });
}

/* ---------------- routes ---------------- */

/**
 * GET /api/admin/pending-payouts
 * (Unchanged) — List users eligible for an initial payout by legacy flags.
 */
router.get('/pending-payouts', auth, async (req, res) => {
  try {
    const users = await User.find({
      'payoutStatus.isFirstPayoutHandled': false,
      'payoutStatus.currentBalance': { $gte: 5000 },
    }).lean();

    res.status(200).json(users);
  } catch (err) {
    console.error('pending-payouts error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

/**
 * POST /api/admin/approve-payout/:userId
 * Production: create Payout + lock funds + initiate Paystack transfer.
 * Webhook will mark it PAID/FAILED later.
 *
 * Contract with services:
 *  - ensureRecipient({ accountName, accountNumber, bankCode }) -> Promise<string> recipientCode
 *  - initiateTransfer({ amountNaira, recipientCode, reference, reason })
 *      -> Promise<{ transfer_code?: string, reference: string }>
 *    (service converts NGN → KOBO internally for Paystack)
 */
router.post('/approve-payout/:userId', auth, async (req, res) => {
  let session;
  let payoutDoc; // visible in outer catch for rollback
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Determine payable amount (ledger-first; legacy fallback)
    const ledgerAvailable = await getAvailableBalance('user', user._id);
    const legacyCurrent = Number(user?.payoutStatus?.currentBalance || 0);
    const amount = Math.round(ledgerAvailable > 0 ? ledgerAvailable : legacyCurrent);

    if (!amount || amount < MIN_PAYOUT_NGN) {
      return res.status(400).json({ message: `No payable balance (min ₦${MIN_PAYOUT_NGN.toLocaleString()})` });
    }

    // Bank snapshot from locked account
    const bank = pickLockedUserBankSnapshot(user);
    if (!bank || !(bank.accountName && bank.accountNumber && bank.bankCode)) {
      return res.status(400).json({ message: 'Please add and lock a payout account for the user first' });
    }

    // Start transaction: create payout + lock ledger
    session = await mongoose.startSession();
    session.startTransaction();

    [payoutDoc] = await Payout.create([{
      payeeType: 'user',
      userId: user._id,
      amount,                // NGN here (your service will convert to kobo)
      currency: 'NGN',
      status: 'requested',   // will move to processing after transfer init
      method: 'transfer',
      provider: 'paystack',
      requestedBy: req.user?._id,
      balanceAtRequest: ledgerAvailable,
      bank,
      meta: { source: 'admin_first_payout' },
    }], { session });

    await createHoldDebitIfMissing(payoutDoc, session);

    await session.commitTransaction();
    session.endSession();
    session = null;

    // Optional: local-only fake mode to test webhook without calling Paystack
    if (process.env.PAYOUTS_FAKE_TRANSFER === 'true') {
      payoutDoc.transferRef = payoutDoc.transferRef || `TRF_FAKE_${payoutDoc._id}`;
      payoutDoc.status = 'processing';
      await payoutDoc.save();

      user.payoutStatus = user.payoutStatus || {};
      user.payoutStatus.isFirstPayoutHandled = true;
      user.payoutStatus.lastPayoutDate = new Date();
      await user.save();

      return res.json({
        message: 'Fake processing set (PAYOUTS_FAKE_TRANSFER=true). Use webhook to mark paid/failed.',
        payoutId: payoutDoc._id,
        transferRef: payoutDoc.transferRef,
        status: payoutDoc.status,
      });
    }

    // === Real Paystack path ===

    // 1) Ensure recipient (returns recipient_code string)
    const recipientCode = await ensureRecipient({
      accountName: bank.accountName,
      accountNumber: bank.accountNumber,
      bankCode: bank.bankCode,
    });

    // 2) Initiate transfer (idempotent reference)
    const reference = `PAYOUT-${payoutDoc._id}`;
    const tx = await initiateTransfer({
      amountNaira: amount,   // keep NGN here; service converts to KOBO
      recipientCode,
      reference,
      reason: `User payout ${user._id}`,
    });

    // Accept either transfer_code or reference from the service
    const transferRef = tx.transfer_code || tx.reference;

    // 3) Update payout with transfer info; move to processing
    payoutDoc.transferRef = transferRef;
    payoutDoc.status = 'processing';
    payoutDoc.meta = { ...(payoutDoc.meta || {}), recipientCode };
    await payoutDoc.save();

    // 4) Mark first payout gate as handled (UI stops flagging)
    user.payoutStatus = user.payoutStatus || {};
    user.payoutStatus.isFirstPayoutHandled = true;
    user.payoutStatus.lastPayoutDate = new Date();
    // Do NOT zero legacy currentBalance here — ledger is the source of truth now.
    await user.save();

    return res.json({
      message: 'Payout initiated; webhook will mark PAID when confirmed.',
      payoutId: payoutDoc._id,
      transferRef,
      status: payoutDoc.status,
    });
  } catch (e) {
    // If DB transaction was still open, abort it
    if (session) {
      try { await session.abortTransaction(); } catch {}
      try { session.endSession(); } catch {}
      session = null;
    }

    // If Paystack failed after we created/locked the payout, reverse the lock and revert status
    try {
      if (payoutDoc) {
        await reverseHoldIfAny(payoutDoc, 'init_fail');
        payoutDoc.status = 'requested';
        await payoutDoc.save();
      }
    } catch (re) {
      // non-fatal; log and continue surfacing the original error
      console.error('reverseHoldIfAny error:', re?.message || re);
    }

    // Surface Paystack’s real error (no more generic 500s)
    const pd = e?.response?.data;
    const message = pd?.message || e.message || 'Paystack error';
    const out = {
      message,
      code: pd?.code || pd?.error || null,
      type: pd?.type || null,
      meta: pd?.meta || null,
    };
    if (
      (out.code === 'missing_params' || out.type === 'validation_error') &&
      /phone number/i.test(out.message || '')
    ) {
      out.hint = 'Add your Business Phone Number in Paystack → Settings → Compliance (same mode as your secret key), then retry.';
    }

    const status = e?.response?.status || 400;
    console.error('approve-payout error:', pd || e.message || e);
    return res.status(status).json(out);
  }
});

module.exports = router;

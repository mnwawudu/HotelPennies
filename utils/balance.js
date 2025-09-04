// backend/utils/balance.js
const LedgerEntry = require('../models/ledgerEntryModel');
const Payout = require('../models/payoutModel');

/**
 * Returns balances in kobo:
 * - totalCredits: all positive ledger
 * - totalDebits: absolute value of negative ledger
 * - ledgerNet: credits - debits
 * - onHold: sum of payout amounts where status in ['requested','processing']
 * - payableBalance: Math.max(ledgerNet - onHold, 0)
 */
async function computePayeeBalances(payeeType, payeeId) {
  const [{ credits = 0, debitsAbs = 0 } = {}] = await LedgerEntry.aggregate([
    { $match: { payeeType, payeeId } },
    {
      $group: {
        _id: null,
        credits: {
          $sum: {
            $cond: [{ $gt: ['$amount', 0] }, '$amount', 0],
          },
        },
        debitsAbs: {
          $sum: {
            $cond: [{ $lt: ['$amount', 0] }, { $abs: '$amount' }, 0],
          },
        },
      },
    },
  ]);

  const ledgerNet = (credits || 0) - (debitsAbs || 0);

  const activePayouts = await Payout.aggregate([
    {
      $match: {
        payeeType,
        payeeId,
        status: { $in: ['requested', 'processing'] },
      },
    },
    {
      $group: {
        _id: null,
        onHold: { $sum: '$amount' },
      },
    },
  ]);

  const onHold = activePayouts?.[0]?.onHold || 0;
  const payableBalance = Math.max(ledgerNet - onHold, 0);

  return {
    totalCredits: credits || 0,
    totalDebits: debitsAbs || 0,
    ledgerNet,
    onHold,
    payableBalance,
  };
}

/** Helper to read min payout from env (₦5,000 default). Returns kobo. */
function minPayoutKobo() {
  const naira = Number(process.env.MIN_PAYOUT_NGN || 5000);
  return Math.max(Math.floor(naira * 100), 0);
}

/** Format kobo → naira float (for UI responses only) */
function koboToNaira(kobo) {
  return Math.round(kobo) / 100;
}

module.exports = {
  computePayeeBalances,
  minPayoutKobo,
  koboToNaira,
};

// utils/reverseBookingEarnings.js
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');

/**
 * Reverses buyer cashback and referrer commission for a booking,
 * and posts compensating negatives + a Ledger 'adjustment'.
 * Idempotent: safe to call multiple times for the same booking.
 *
 * @param {Object} opts
 * @param {Object} opts.booking  - Mongoose booking doc (must have _id, email)
 * @param {('hotel'|'shortlet')} [opts.category='hotel'] - For meta tagging only
 */
async function reverseBookingEarnings({ booking, category = 'hotel' }) {
  if (!booking?._id) return;

  // 1) Buyer cashback reversal (if buyer exists)
  const buyerEmail = String(booking.email || '').toLowerCase();
  const buyer = await User.findOne({ email: buyerEmail }).exec();
  if (buyer) {
    buyer.earnings = Array.isArray(buyer.earnings) ? buyer.earnings : (buyer.earnings ? [buyer.earnings] : []);
    buyer.payoutStatus = buyer.payoutStatus || {};

    let reversed = 0;
    let changed = false;

    buyer.earnings.forEach((e) => {
      const sid = String(e?.sourceId || '');
      const src = String(e?.source || '').toLowerCase(); // cashback uses 'transaction'
      if (sid === String(booking._id) && src === 'transaction' && e?.status !== 'reversed') {
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

    if (changed && reversed > 0) {
      if (!hasNeg) {
        buyer.earnings.push({
          amount: -reversed,
          source: 'transaction_reversal',
          sourceId: booking._id,
          status: 'posted',
          createdAt: new Date(),
        });
      }
      buyer.payoutStatus.totalEarned = Math.max(0, Number(buyer.payoutStatus.totalEarned || 0) - reversed);
      buyer.payoutStatus.currentBalance = Math.max(0, Number(buyer.payoutStatus.currentBalance || 0) - reversed);
      await buyer.save();

      const exists = await Ledger.findOne({
        accountType: 'user',
        accountId: buyer._id,
        bookingId: booking._id,
        sourceType: 'adjustment',
        reason: 'adjustment',
        'meta.subtype': 'user_cashback_reversal',
      }).lean();

      if (!exists) {
        await Ledger.create({
          accountType: 'user',
          accountId: buyer._id,
          sourceType: 'adjustment',
          direction: 'debit',
          amount: reversed,
          currency: 'NGN',
          status: 'available',
          reason: 'adjustment',
          bookingId: booking._id,
          meta: { subtype: 'user_cashback_reversal', category },
        });
      }
    }
  }

  // 2) Referrer commission reversal
  let refUser = null;
  let refAmountFromLedger = 0;

  // Prefer Ledger to find the exact referrer + amount
  const refCredit = await Ledger.findOne({
    reason: 'user_referral_commission',
    bookingId: booking._id,
    accountType: 'user',
    direction: 'credit',
  }).lean();

  if (refCredit?.accountId) {
    refUser = await User.findById(refCredit.accountId).exec();
    if (refUser) refAmountFromLedger = Number(refCredit.amount || 0);
  }

  // Fallback: any user with a commission/referral earning tied to this booking (NOT buyer cashback)
  if (!refUser) {
    refUser = await User.findOne({
      'earnings.sourceId': booking._id,
      'earnings.source': { $ne: 'transaction' }, // exclude cashback
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

    if (changed && finalCommission > 0) {
      if (!hasNeg) {
        refUser.earnings.push({
          amount: -finalCommission,
          source: 'referral_reversal',
          sourceId: booking._id,
          status: 'posted',
          createdAt: new Date(),
        });
      }
      refUser.payoutStatus.totalEarned = Math.max(0, Number(refUser.payoutStatus.totalEarned || 0) - finalCommission);
      refUser.payoutStatus.currentBalance = Math.max(0, Number(refUser.payoutStatus.currentBalance || 0) - finalCommission);
      await refUser.save();

      const exists = await Ledger.findOne({
        accountType: 'user',
        accountId: refUser._id,
        bookingId: booking._id,
        sourceType: 'adjustment',
        reason: 'adjustment',
        'meta.subtype': 'user_referral_reversal',
      }).lean();

      if (!exists) {
        await Ledger.create({
          accountType: 'user',
          accountId: refUser._id,
          sourceType: 'adjustment',
          direction: 'debit',
          amount: finalCommission,
          currency: 'NGN',
          status: 'available',
          reason: 'adjustment',
          bookingId: booking._id,
          meta: { subtype: 'user_referral_reversal', category },
        });
      }
    }
  }
}

module.exports = { reverseBookingEarnings };

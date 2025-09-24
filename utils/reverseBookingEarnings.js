// utils/reverseBookingEarnings.js
const User = require('../models/userModel');
const Ledger = require('../models/ledgerModel');

async function reverseBookingEarnings({ booking, category = 'hotel' }) {
  if (!booking?._id) return;

  const DEV = false;
  const log  = (...a) => DEV && console.log('[reverseEarnings]', ...a);
  const warn = (...a) => DEV && console.warn('[reverseEarnings]', ...a);
  const B_ID = String(booking._id);

  const normalizeEarn = (u) => {
    u.earnings = Array.isArray(u.earnings) ? u.earnings : (u.earnings ? [u.earnings] : []);
    u.payoutStatus = u.payoutStatus || {};
  };
  const isReferralSrc = (s = '') => /referr|commiss/.test(String(s).toLowerCase());
  const parseMoney = (v) => {
    if (v == null) return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const n = Number(v.replace(/,/g, '').replace(/[^\d.-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  };

  const bookingAmount = [
    booking.total, booking.totalPrice, booking.price, booking.amount, booking.paidAmount,
  ].reduce((s, v) => (s || parseMoney(v)), 0);

  const REFERRAL_PCT = Number(process.env.REFERRAL_PCT || 4);

  // ---------- BUYER CASHBACK ----------
  try {
    const buyerEmail = String(booking.email || '').toLowerCase();
    if (buyerEmail) {
      const buyer = await User.findOne({ email: buyerEmail }).exec();
      if (buyer) {
        normalizeEarn(buyer);

        // Find original cashback credit ledger row (to mirror its status)
        const originalCashbackCredit = await Ledger.findOne({
          accountType: 'user',
          accountId: buyer._id,
          bookingId: booking._id,
          direction: 'credit',
          reason: { $in: ['user_cashback', 'cashback'] },
        }).sort({ _id: -1 }).lean();

        const originalCashbackStatus = originalCashbackCredit?.status || 'available';

        const before = {
          total: Number(buyer.payoutStatus.totalEarned || 0),
          bal:   Number(buyer.payoutStatus.currentBalance || 0),
        };

        let reversed = 0;
        let changed  = false;

        // Flip buyer earnings rows to reversed
        buyer.earnings.forEach((e) => {
          const sid = String(e?.sourceId || '');
          const src = String(e?.source || '').toLowerCase();
          if (sid === B_ID && src === 'transaction' && e?.status !== 'reversed') {
            reversed += Number(e?.amount || 0);
            e.status = 'reversed';
            e.reversalReason = 'booking_cancelled';
            e.reversalDate = new Date();
            changed = true;
          }
        });

        const hasNeg = buyer.earnings.some(
          (e) => String(e?.sourceId || '') === B_ID && String(e?.source || '') === 'transaction_reversal'
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

          // Lifetime total should drop
          buyer.payoutStatus.totalEarned = Math.max(0, before.total - reversed);
          // Only dock "available" balance if the original credit was available
          if (String(originalCashbackStatus).toLowerCase() === 'available') {
            buyer.payoutStatus.currentBalance = Math.max(0, before.bal - reversed);
          }

          await buyer.save();

          // Create the audit ledger debit with mirrored status
          const exists = await Ledger.findOne({
            accountType: 'user',
            accountId: buyer._id,
            bookingId: booking._id,
            sourceType: 'adjustment',
            direction: 'debit',
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
              status: originalCashbackStatus, // ← mirror status
              reason: 'adjustment',
              bookingId: booking._id,
              meta: { subtype: 'user_cashback_reversal', category },
            });
          }

          // Mark original cashback credit rows as reversed so UI/payout won’t re-count them
          await Ledger.updateMany(
            {
              accountType: 'user',
              accountId: buyer._id,
              bookingId: booking._id,
              direction: 'credit',
              reason: { $in: ['user_cashback', 'cashback'] },
              status: { $ne: 'reversed' },
            },
            { $set: { status: 'reversed' } }
          );

          log('buyer cashback reversed', { amount: reversed, before, after: buyer.payoutStatus });
        }
      } else {
        log('buyer not found for email', buyerEmail);
      }
    } else {
      log('buyer email missing; skip cashback reversal');
    }
  } catch (e) {
    warn('buyer cashback reversal error:', e?.message || e);
  }

  // ---------- REFERRER COMMISSION ----------
  try {
    // 1) Ledger sum (source of truth)
    const refCredits = await Ledger.aggregate([
      {
        $match: {
          bookingId: booking._id,
          accountType: 'user',
          direction: 'credit',
          reason: { $in: ['user_referral_commission', 'referral_commission', 'referrer_commission'] },
        }
      },
      { $group: { _id: '$accountId', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
      { $limit: 1 },
    ]);

    let refUser = null;
    let ledgerSum = 0;

    if (refCredits.length) {
      ledgerSum = Number(refCredits[0].amount || 0);
      refUser   = await User.findById(refCredits[0]._id).exec();
      if (refUser) log('referral located via ledger', { refUser: String(refUser._id), amount: ledgerSum });
    }

    // 2) Fallback: hinted IDs on booking
    if (!refUser) {
      const hinted = booking.referredByUserId || booking.commissionRefUserId || booking.referrerUserId || null;
      if (hinted) {
        refUser = await User.findById(hinted).exec();
        if (refUser) log('referral located via booking.*RefUserId', { refUser: String(refUser._id) });
      }
    }

    // 3) Fallback: scan user.earnings
    if (!refUser) {
      refUser = await User.findOne({
        'earnings.sourceId': booking._id,
        $or: [{ 'earnings.source': /referr/i }, { 'earnings.source': /commiss/i }],
      }).exec();
      if (refUser) log('referral located via user.earnings', { refUser: String(refUser._id) });
    }

    if (!refUser) {
      log('no referrer found; nothing to reverse');
      return;
    }

    normalizeEarn(refUser);

    // Flip earnings rows to reversed (for visibility)
    let earningsSum = 0;
    refUser.earnings.forEach((e) => {
      const sid = String(e?.sourceId || '');
      const src = String(e?.source || '');
      if (sid === B_ID && isReferralSrc(src) && e?.status !== 'reversed') {
        earningsSum += Number(e?.amount || 0);
        e.status = 'reversed';
        e.reversalReason = 'booking_cancelled';
        e.reversalDate = new Date();
      }
    });

    // Decide amount
    let amountToReverse = 0;
    if (ledgerSum > 0) {
      amountToReverse = ledgerSum;
      if (earningsSum > 0 && earningsSum !== ledgerSum) {
        warn('earnings vs ledger mismatch; reversing ledger sum only', { ledgerSum, earningsSum });
      }
    } else if (earningsSum > 0) {
      amountToReverse = earningsSum;
    } else if (bookingAmount > 0) {
      amountToReverse = Math.round((bookingAmount * REFERRAL_PCT) / 100);
      log('computed fallback referral commission', { pct: REFERRAL_PCT, amount: amountToReverse });
    }

    if (amountToReverse <= 0) {
      log('referrer: nothing to reverse (no credited amount found)');
      await refUser.save(); // persist any status flips
      return;
    }

    const hasNeg = refUser.earnings.some(
      (e) => String(e?.sourceId || '') === B_ID && String(e?.source || '') === 'referral_reversal'
    );

    // Find a real original commission credit row to mirror its status
    const originalRefCredit = await Ledger.findOne({
      accountType: 'user',
      accountId: refUser._id,
      bookingId: booking._id,
      direction: 'credit',
      reason: { $in: ['user_referral_commission', 'referral_commission', 'referrer_commission'] },
    }).sort({ _id: -1 }).lean();

    const originalRefStatus = originalRefCredit?.status || 'available';

    const before = {
      total: Number(refUser.payoutStatus.totalEarned || 0),
      bal:   Number(refUser.payoutStatus.currentBalance || 0),
    };

    if (!hasNeg) {
      refUser.earnings.push({
        amount: -amountToReverse,
        source: 'referral_reversal',
        sourceId: booking._id,
        status: 'posted',
        createdAt: new Date(),
      });
    }

    // Lifetime total drops
    refUser.payoutStatus.totalEarned = Math.max(0, before.total - amountToReverse);
    // Only dock available balance if the original commission was available
    if (String(originalRefStatus).toLowerCase() === 'available') {
      refUser.payoutStatus.currentBalance = Math.max(0, before.bal - amountToReverse);
    }
    await refUser.save();

    // Create or reuse the audit ledger *debit adjustment* with mirrored status
    let reversalRow = await Ledger.findOne({
      accountType: 'user',
      accountId: refUser._id,
      bookingId: booking._id,
      sourceType: 'adjustment',
      direction: 'debit',
      reason: 'adjustment',
      'meta.subtype': 'user_referral_reversal',
    }).lean();

    if (!reversalRow) {
      reversalRow = await Ledger.create({
        accountType: 'user',
        accountId: refUser._id,
        sourceType: 'adjustment',
        direction: 'debit',
        amount: amountToReverse,
        currency: 'NGN',
        status: originalRefStatus, // ← mirror status
        reason: 'adjustment',
        bookingId: booking._id,
        meta: { subtype: 'user_referral_reversal', category },
      });
    }

    // Mark original commission credits as reversed so UI/payout won’t pick them up
    await Ledger.updateMany(
      {
        accountType: 'user',
        accountId: refUser._id,
        bookingId: booking._id,
        direction: 'credit',
        reason: { $in: ['user_referral_commission', 'referral_commission', 'referrer_commission'] },
        status: { $ne: 'reversed' },
      },
      { $set: { status: 'reversed', 'meta.reversedBy': reversalRow?._id || null } }
    );

    log('referrer commission reversed', {
      refUser: String(refUser._id),
      amount: amountToReverse,
      before,
      after: refUser.payoutStatus,
    });
  } catch (e) {
    warn('referrer commission reversal error:', e?.message || e);
  }
}

module.exports = { reverseBookingEarnings };

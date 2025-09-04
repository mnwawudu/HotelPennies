const User = require('../models/userModel');

async function rewardReferral({ buyerEmail, bookingId, price, referrerId }) {
  try {
    console.log('🔧 rewardReferral ctx:', {
      buyerEmail,
      bookingId: String(bookingId),
      price,
      referrerId: String(referrerId),
    });

    const referrer = await User.findById(referrerId).exec();
    if (!referrer) {
      console.log('⚠️ Referrer not found; skipping.');
      return;
    }
    console.log('👤 Referrer found:', referrer.email);

    const amount = Math.round(Number(price) * 0.05);
    referrer.referredEmails = Array.isArray(referrer.referredEmails) ? referrer.referredEmails : [];

    const buyerEmailLc = (buyerEmail || '').toLowerCase();
    const alreadyPaid = referrer.referredEmails.includes(buyerEmailLc);

    if (alreadyPaid) {
      console.log(`⛔ Skipping commission: already paid for buyer ${buyerEmailLc}`);
      return;
    }

    // Mark this email to prevent future duplicate commission
    referrer.referredEmails.push(buyerEmailLc);

    referrer.earnings = referrer.earnings || [];
    referrer.payoutStatus = referrer.payoutStatus || {};
    referrer.referralConversions = referrer.referralConversions || [];

    referrer.earnings.push({
      amount,
      source: 'booking',      // commission
      sourceId: bookingId,
      status: 'pending',
    });
    referrer.payoutStatus.totalEarned = (referrer.payoutStatus.totalEarned || 0) + amount;
    referrer.payoutStatus.currentBalance = (referrer.payoutStatus.currentBalance || 0) + amount;

    referrer.referralConversions.push({
      referralId: undefined,  // guest or unknown here
      bookingId,
      amountEarned: amount,
      date: new Date(),
    });

    await referrer.save();
    console.log(`💰 Commission credited to referrer ${referrer.email}: ${amount}`);
  } catch (err) {
    console.error('❌ rewardReferral error:', err);
  }
}

module.exports = rewardReferral;

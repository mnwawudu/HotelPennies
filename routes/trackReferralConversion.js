if (req.body.referredByUserId) {
  const referrer = await User.findById(req.body.referredByUserId);
  if (referrer) {
    const commission = totalPrice * 0.05;
    referrer.referralConversions.push({
      referralId: req.userId,
      bookingId: newBooking._id,
      amountEarned: commission
    });

    // Also add to earnings and update balance
    referrer.earnings.push({
      amount: commission,
      source: 'booking',
      sourceId: newBooking._id,
      status: 'pending'
    });

    referrer.payoutStatus.totalEarned += commission;
    referrer.payoutStatus.currentBalance += commission;
    await referrer.save();
  }
}

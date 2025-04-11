const Payout = require('./Payout');

const getPayouts = async (req, res) => {
  try {
    const payouts = await Payout.find({ userId: req.user.id });
    res.status(200).json({ success: true, data: payouts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getPayouts };

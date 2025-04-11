const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: Number,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payout', payoutSchema);

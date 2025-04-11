// models/payoutModel.js
const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending',
  },
  dateRequested: {
    type: Date,
    default: Date.now,
  },
});

const Payout = mongoose.model('Payout', payoutSchema);

module.exports = Payout;

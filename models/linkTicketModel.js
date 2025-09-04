// models/linkTicketModel.js
const mongoose = require('mongoose');

const linkTicketSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId:        { type: mongoose.Schema.Types.ObjectId, required: true },
  bookingCategory:  { type: String, enum: ['hotel','shortlet','event','restaurant','tour','chops','gifts'], required: true },

  emailTo:          { type: String, required: true },

  codeHash:         { type: String, required: true, select: true },
  expiresAt:        { type: Date, required: true },
  usedAt:           { type: Date, default: null },
}, { timestamps: true });

// Helpful indexes
linkTicketSchema.index({ userId: 1, createdAt: -1 });
linkTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-cleanup after expiry
linkTicketSchema.index({ bookingId: 1 });

module.exports = mongoose.model('LinkTicket', linkTicketSchema);

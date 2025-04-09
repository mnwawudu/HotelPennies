const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['shortlet', 'hotel'], required: true },
  propertyId: String,
  date: String,
  baseCost: Number,
  rideRequested: { type: Boolean, default: false },
  pickupLocation: String, // optional: e.g., "Airport", "Home"
  rideCost: { type: Number, default: 0 },
  totalCost: Number,
  status: { type: String, default: 'pending' }
});

module.exports = mongoose.model('Booking', bookingSchema);

const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  businessType: {
    type: String, // e.g., "chop", "gift", "shortlet", "room", "menu", "event", "cruise", "carHire"
    required: true
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId, // ID of the actual item (e.g. Chop ID, Gift ID, Room ID)
    required: true
  },
  itemName: String,
  quantity: Number,
  unitPrice: Number,
  totalPrice: Number,
  deliveryFee: Number,
  finalPrice: Number,

  vendor: { // optional – used only for vendor-controlled orders
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  },

  status: {
    type: String,
    enum: ['pending', 'paid', 'completed', 'cancelled'],
    default: 'pending'
  },

  isFeaturedOrder: {
    type: Boolean,
    default: false // true only if this was a payment for feature listing
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Order', orderSchema);

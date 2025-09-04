const mongoose = require('mongoose');

const advertSchema = new mongoose.Schema({
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },

  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String, default: '' }, // optional
  state: { type: String, default: '' },
  city: { type: String, default: '' },

  scope: {
    type: String,
    enum: ['local', 'global'],
    default: 'local'
  },

  price: { type: Number, required: true },
  paidStatus: { type: Boolean, default: false },
  featured: { type: Boolean, default: false },

  subscriptionPeriod: {
    type: String,
    enum: ['weekly', 'monthly', '1 year'],
    default: 'weekly'
  },

  isActive: { type: Boolean, default: true },

  imageUrl: { type: String },

  // ✅ Fixed: placement now defined correctly
  placement: {
    type: [String],
    default: []
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Advert', advertSchema);

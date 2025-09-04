const mongoose = require('mongoose');

const pickupDeliverySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['pickup', 'delivery'],
    required: true,
  },
  businessType: {
    type: String,
    enum: ['hotel', 'shortlet', 'restaurant', 'eventcenter', 'tourguide', 'chops', 'gifts'],
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  fromZone: {
    type: String,
    enum: ['Ikeja', 'Lekki', 'Ajah', 'Yaba', 'Surulere', 'VI', 'Ikoyi', 'Agege', 'Ogba', 'Maryland'],
    required: function () {
      return this.state === 'Lagos';
    },
  },
  toZone: {
    type: String,
    enum: ['Ikeja', 'Lekki', 'Ajah', 'Yaba', 'Surulere', 'VI', 'Ikoyi', 'Agege', 'Ogba', 'Maryland'],
    required: function () {
      return this.state === 'Lagos';
    },
  },
  price: {
    type: Number,
    required: true,
  },
  estimatedTime: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('PickupDeliveryOption', pickupDeliverySchema);

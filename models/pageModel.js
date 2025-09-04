// ✅ models/pageModel.js
const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['hotel', 'shortlet', 'restaurant', 'eventcenter', 'tourguide', 'chop', 'cruise', 'carhire', 'gift', 'others'],
  },
  title: { type: String, required: true },
  content: { type: String, default: '' },
  showOnHome: { type: Boolean, default: false },
}, {
  timestamps: true
});

module.exports = mongoose.model('Page', pageSchema);

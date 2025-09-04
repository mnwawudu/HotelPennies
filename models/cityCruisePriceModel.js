const mongoose = require('mongoose');

const cityCruisePriceSchema = new mongoose.Schema({
  duration: {
    type: String,
    required: true,
    unique: true
  },
  price: {
    type: Number,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('CityCruisePrice', cityCruisePriceSchema);

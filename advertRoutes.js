const mongoose = require('mongoose');

const advertSchema = new mongoose.Schema({
  title: String,
  description: String,
  imageUrl: String,
  link: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Advert', advertSchema);

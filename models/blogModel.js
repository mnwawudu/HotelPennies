const mongoose = require('mongoose');

const blogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  snippet: { type: String },
  image: [{ type: String }], // ✅ array of image URLs
  author: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now },
  showOnHome: { type: Boolean, default: false }
});

module.exports = mongoose.model('Blog', blogSchema);

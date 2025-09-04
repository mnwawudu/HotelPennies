const express = require('express');
const router = express.Router();
const Blog = require('../models/blogModel');
const auth = require('../middleware/adminAuth');
const upload = require('../middleware/upload'); // ✅ handles Cloudinary

// ✅ GET all blogs (public)
router.get('/', async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    console.error('❌ Failed to fetch blogs:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ GET single blog by ID (public)
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ message: 'Blog not found' });
    res.json(blog);
  } catch (err) {
    console.error('❌ Failed to fetch blog:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ POST create blog (admin only)
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, image, snippet, author, showOnHome } = req.body;

    const newBlog = await Blog.create({
      title,
      content,
      image,
      snippet,
      author,
      showOnHome
    });

    res.status(201).json(newBlog);
  } catch (err) {
    console.error('❌ Failed to create blog:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ PUT update blog (admin only)
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, content, image, snippet, author, showOnHome } = req.body;

    const updated = await Blog.findByIdAndUpdate(
      req.params.id,
      { title, content, image, snippet, author, showOnHome },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Blog not found' });
    res.json(updated);
  } catch (err) {
    console.error('❌ Failed to update blog:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ DELETE blog (admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    await Blog.findByIdAndDelete(req.params.id);
    res.json({ message: 'Blog deleted' });
  } catch (err) {
    console.error('❌ Failed to delete blog:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ UPLOAD image to Cloudinary
router.post('/upload', auth, upload.single('image'), async (req, res) => {
  try {
    const imageUrl = req.file?.path || req.file?.secure_url || req.file?.url;

    if (!imageUrl) {
      return res.status(400).json({ message: 'No image URL returned from Cloudinary' });
    }

    res.json({ url: imageUrl });
  } catch (err) {
    console.error('❌ Failed to upload blog image:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

module.exports = router;

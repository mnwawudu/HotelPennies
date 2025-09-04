const express = require('express');
const router = express.Router();
const Page = require('../models/pageModel');
const adminAuth = require('../middleware/adminAuth'); // Ensure only admin can modify pages

// 🔹 Create a page
router.post('/', adminAuth, async (req, res) => {
  try {
    const { type, title, content, showOnHome } = req.body;
    const newPage = new Page({ type, title, content, showOnHome });
    await newPage.save();
    res.status(201).json(newPage);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create page' });
  }
});

// 🔹 Get all pages
router.get('/', adminAuth, async (req, res) => {
  try {
    const pages = await Page.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch pages' });
  }
});

// 🔹 Update a page
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const updatedPage = await Page.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedPage);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update page' });
  }
});

// 🔹 Delete a page
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await Page.findByIdAndDelete(req.params.id);
    res.json({ message: 'Page deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete page' });
  }
});

module.exports = router;

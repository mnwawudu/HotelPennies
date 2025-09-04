const express = require('express');
const router = express.Router();
const CruiseInquiry = require('../models/cruiseInquiry');

// ✅ POST a new inquiry
router.post('/', async (req, res) => {
  try {
    const inquiry = new CruiseInquiry(req.body);
    await inquiry.save();
    res.status(201).json({ message: 'Inquiry submitted successfully', inquiry });
  } catch (error) {
    console.error('❌ Failed to submit cruise inquiry:', error);
    res.status(500).json({ message: 'Failed to submit inquiry' });
  }
});

// ✅ GET all inquiries (admin only — add adminAuth if needed)
router.get('/', async (req, res) => {
  try {
    const inquiries = await CruiseInquiry.find().sort({ createdAt: -1 });
    res.json(inquiries);
  } catch (error) {
    console.error('❌ Failed to fetch cruise inquiries:', error);
    res.status(500).json({ message: 'Failed to fetch inquiries' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/userModel');  // Assuming the user model exists

// Dashboard route (GET /api/dashboard/:id)
router.get('/dashboard/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);  // Find user (vendor) by ID
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return vendor's name and affiliateCode (vendorId)
    res.json({
      name: user.name,
      affiliateCode: user.affiliateCode,  // Vendor ID (affiliateCode)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

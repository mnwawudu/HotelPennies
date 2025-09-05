const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Vendor = require('../models/vendorModel'); // âœ… Add this line


// âœ… GET current vendor services
router.get('/me', auth, async (req, res) => {
  try {
    let record = await VendorService.findOne({ vendorId: req.user._id });
    if (!record) record = await VendorService.create({ vendorId: req.user._id });

    res.json({ services: record.services });
  } catch (err) {
    console.error('âŒ Failed to fetch services:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… PUT to add/remove service
router.put('/services', auth, async (req, res) => {
  const { service, action } = req.body;
  if (!service || !['add', 'remove'].includes(action)) {
    return res.status(400).json({ message: 'Invalid service or action' });
  }

  try {
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // Normalize
    const normalizedService = service.toLowerCase();

    if (action === 'add') {
      const exists = vendor.businessTypes.some(
        item => item.serviceType?.toLowerCase() === normalizedService
      );
      if (!exists) {
        vendor.businessTypes.push({ serviceType: normalizedService });
      }
    } else if (action === 'remove') {
      vendor.businessTypes = vendor.businessTypes.filter(
        item => item.serviceType?.toLowerCase() !== normalizedService
      );
    }

    await vendor.save();
    res.json({ message: 'Service updated successfully', businessTypes: vendor.businessTypes });
  } catch (err) {
    console.error('âŒ Failed to update vendor services:', err);
    res.status(500).json({ message: 'Failed to update services' });
  }
});

module.exports = router;


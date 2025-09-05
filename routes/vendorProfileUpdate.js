const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendorModel');
const auth = require('../middleware/auth');
const multer = require('multer');
const crypto = require('crypto');

// Set up multer storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Hash file buffer for duplication check
const hashFile = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

// Fake file path generator
const fakeFileUrl = (originalName, label) =>
  `uploads/${Date.now()}_${label}_${originalName}`;

// Auto verify logic
const autoVerifyVendor = async (vendor) => {
  const hasMeansOfId = !!vendor.documents.meansOfId;
  const hasCAC = !!vendor.documents.cacCertificate;
  const hasProof = !!vendor.documents.proofOfAddress;

  const isTourGuide = vendor.businessTypes?.includes('tour guide');

  if (hasMeansOfId && (isTourGuide || (hasCAC && hasProof))) {
    vendor.isFullyVerified = true;
    if (!vendor.isVerifiedTypes.includes('general')) {
      vendor.isVerifiedTypes.push('general');
    }
  } else {
    vendor.isFullyVerified = false;
  }

  await vendor.save();
};

// âœ… PUT: Update Vendor Profile
router.put(
  '/profile',
  auth,
  upload.fields([
    { name: 'meansOfId', maxCount: 1 },
    { name: 'cacCertificate', maxCount: 1 },
    { name: 'proofOfAddress', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const vendor = await Vendor.findById(req.vendorId); // âœ… FIXED HERE

      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      const { name, phone, address, businessTypes } = req.body;

      const isTourGuide = Array.isArray(businessTypes)
        ? businessTypes.includes('tour guide')
        : (businessTypes === 'tour guide');

      if (name) vendor.name = name;
      if (phone) vendor.phone = phone;
      if (address) vendor.address = address;

      if (businessTypes) {
        vendor.businessTypes = Array.isArray(businessTypes)
          ? businessTypes
          : [businessTypes];
      }

      // Upload Means of ID
      if (req.files.meansOfId) {
        const buffer = req.files.meansOfId[0].buffer;
        const hash = hashFile(buffer);
        const fileUrl = fakeFileUrl(req.files.meansOfId[0].originalname, 'meansOfId');

        const duplicate = await Vendor.findOne({
          _id: { $ne: vendor._id },
          'documents.meansOfIdHash': hash
        });

        if (duplicate) {
          return res.status(400).json({ message: 'This ID document is already used by another vendor.' });
        }

        vendor.documents.meansOfId = fileUrl;
        vendor.documents.meansOfIdHash = hash;
      }

      // Upload CAC (if not tour guide)
      if (!isTourGuide && req.files.cacCertificate) {
        const fileUrl = fakeFileUrl(req.files.cacCertificate[0].originalname, 'cac');
        vendor.documents.cacCertificate = fileUrl;
      }

      // Upload Proof of Address (if not tour guide)
      if (!isTourGuide && req.files.proofOfAddress) {
        const fileUrl = fakeFileUrl(req.files.proofOfAddress[0].originalname, 'proof');
        vendor.documents.proofOfAddress = fileUrl;
      }

      await vendor.save();
      await autoVerifyVendor(vendor);

      res.status(200).json({ message: 'Profile updated', vendor });
    } catch (err) {
      console.error('Error updating profile:', err.message);
      res.status(500).json({ message: 'Failed to update profile', error: err.message });
    }
  }
);

module.exports = router;


const Vendor = require('../models/vendorModel');

const requiredDocs = {
  'tour guide': ['meansOfId'],
  'hotel': ['meansOfId', 'cacCertificate', 'proofOfAddress'],
  'shortlet': ['meansOfId', 'cacCertificate', 'proofOfAddress'],
  'restaurant': ['meansOfId', 'cacCertificate', 'proofOfAddress'],
  'event center': ['meansOfId', 'cacCertificate', 'proofOfAddress'],
};

const autoVerifyVendor = async (vendor) => {
  const verifiedTypes = [];

  for (const type of vendor.businessTypes) {
    const required = requiredDocs[type];
    const hasAll = required.every(doc => vendor.documents[doc]);
    if (hasAll) {
      verifiedTypes.push(type);
      // Notify only if newly added
      if (!vendor.isVerifiedTypes.includes(type)) {
        vendor.notifications.push({
          message: `You are now verified to list ${type[0].toUpperCase() + type.slice(1)}.`,
        });
      }
    } else {
      const missing = required.filter(doc => !vendor.documents[doc]);
      vendor.notifications.push({
        message: `You’re ${missing.length} document${missing.length > 1 ? 's' : ''} away from listing ${type}.`,
      });
    }
  }

  vendor.isVerifiedTypes = verifiedTypes;
  vendor.isFullyVerified = verifiedTypes.length === vendor.businessTypes.length;

  await vendor.save();
};

module.exports = autoVerifyVendor;

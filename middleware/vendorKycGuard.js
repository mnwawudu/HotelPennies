// middleware/vendorKycGuard.js
module.exports = (required = 'APPROVED') => (req, res, next) => {
  const s = req.user?.kycStatus; // load from DB or JWT claim
  if (required === 'APPROVED' && s !== 'APPROVED') {
    return res.status(403).json({ reason: 'KYC_INCOMPLETE' });
  }
  next();
};

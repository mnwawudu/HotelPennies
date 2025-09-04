const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel'); // vendor fields incl. kycStatus

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return res.status(401).json({ message: 'No or invalid auth header' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing from header' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const role = decoded?.role || 'user';

    // Admin tokens are handled by a separate adminAuth; pass through minimal shape
    if (role === 'admin') {
      req.user = {
        _id: decoded.id,
        id: decoded.id,
        role: 'admin',
        email: decoded.email || undefined,
      };
      req.auth = decoded;
      return next();
    }

    // Always load the fresh account so we have kycStatus/approval/etc.
    let account = null;

    if (role === 'vendor') {
      account = await Vendor.findById(decoded.id)
        .select('email name kycStatus approvalStatus blocked status tokenVersion')
        .lean();
    } else {
      // role === 'user'
      account = await User.findById(decoded.id)
        .select('email name isEmailVerified tokenVersion')
        .lean();
    }

    if (!account) {
      return res.status(401).json({ message: 'Account not found' });
    }

    // Optional tokenVersion invalidation (only if both sides provide a version)
    if (
      typeof account.tokenVersion === 'number' &&
      typeof decoded?.v === 'number' &&
      decoded.v !== account.tokenVersion
    ) {
      return res.status(401).json({ message: 'Token no longer valid. Please sign in again.' });
    }

    // Unified req.user with DB fields (so vendorKycGuard sees kycStatus)
    req.user = {
      ...account,
      _id: account._id,                 // keep ObjectId
      id: String(account._id),          // convenience
      role,
      email: account.email,
    };
    req.auth = decoded;                 // raw claims if you need them

    // For debugging once: console.log('auth ok:', role, req.user.kycStatus);
    next();
  } catch (err) {
    console.error('❌ JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

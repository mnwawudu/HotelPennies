// ✅ middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

module.exports = async function adminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Access denied: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Admin.findById(decoded.id).select('+resetTokenHash -password');
    if (!admin) {
      return res.status(403).json({ message: 'Access denied: Not an admin' });
    }

    // ✅ Allow any valid admin role
    const allowedRoles = new Set(['superadmin', 'manager', 'staff', 'admin']);
    if (!allowedRoles.has(admin.role)) {
      return res.status(403).json({ message: 'Access denied: Not an admin' });
    }

    // ✅ Optional tokenVersion check (invalidate tokens after password change)
    if (typeof decoded.v === 'number' && typeof admin.tokenVersion === 'number') {
      if (decoded.v !== admin.tokenVersion) {
        return res.status(401).json({ message: 'Token no longer valid. Please sign in again.' });
      }
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('❌ Admin auth failed:', err.message);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

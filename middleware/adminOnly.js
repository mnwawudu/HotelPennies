// middleware/adminOnly.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

const ALLOWED_ROLES = new Set(['superadmin', 'manager', 'staff', 'admin']);

module.exports = async function adminOnly(req, res, next) {
  try {
    // Accept Bearer, x-auth-token, or ?token=
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : (req.headers['x-auth-token'] || req.query.token);
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support common claim names
    const adminId = decoded.id || decoded._id || decoded.sub;
    if (!adminId) return res.status(401).json({ message: 'Invalid token' });

    // Fetch admin (exclude password)
    const admin = await Admin.findById(adminId)
      .select('-password -resetTokenHash')
      .lean();

    if (!admin) return res.status(403).json({ message: 'Access denied' });

    // Role allow-list
    const role = String(admin.role || '').toLowerCase().trim();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Token version kill switch (supports decoded.v or decoded.tokenVersion)
    const tokVer =
      typeof decoded.v === 'number'
        ? decoded.v
        : typeof decoded.tokenVersion === 'number'
        ? decoded.tokenVersion
        : undefined;

    if (
      typeof admin.tokenVersion === 'number' &&
      typeof tokVer === 'number' &&
      tokVer !== admin.tokenVersion
    ) {
      return res.status(401).json({ message: 'Token no longer valid. Please sign in again.' });
    }

    // Invalidate if password changed after this token was issued
    if (decoded.iat && admin.passwordUpdatedAt) {
      const iatMs = decoded.iat * 1000;
      if (iatMs < new Date(admin.passwordUpdatedAt).getTime()) {
        return res.status(401).json({ message: 'Session expired (password changed). Please sign in again.' });
      }
    }

    // Attach sanitized admin; also mirror on req.user for legacy code
    req.admin = { ...admin, role };
    req.user = req.admin;

    return next();
  } catch (err) {
    console.error('Admin auth failed:', err?.message || err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

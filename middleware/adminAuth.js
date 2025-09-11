// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

const ALLOWED_ROLES = new Set(['superadmin', 'manager', 'staff', 'admin']);

module.exports = async function adminAuth(req, res, next) {
  try {
    // Accept Bearer, x-auth-token, or ?token=
    const hdr = req.headers.authorization || '';
    const m = hdr.match(/^Bearer\s+(.+)$/i);
    const token = m ? m[1] : (req.headers['x-auth-token'] || req.query.token);
    if (!token) return res.status(401).json({ message: 'Access denied: No token provided' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Support common claim names
    const adminId = decoded.id || decoded._id || decoded.sub;
    if (!adminId) return res.status(401).json({ message: 'Invalid token' });

    // Need role/roles/perms/tokenVersion/passwordUpdatedAt (no password)
    const admin = await Admin.findById(adminId)
      .select('+resetTokenHash role roles perms tokenVersion passwordUpdatedAt email username createdAt updatedAt')
      .lean();

    if (!admin) return res.status(403).json({ message: 'Access denied: Not an admin' });

    // Normalize roles (back-compat if only `role` exists)
    const norm = (s) => String(s || '').toLowerCase().trim();
    const roles = Array.isArray(admin.roles) ? admin.roles.map(norm) : [];
    if (admin.role) roles.push(norm(admin.role));

    // Role allowlist
    const hasAllowed = roles.some((r) => ALLOWED_ROLES.has(r));
    if (!hasAllowed) return res.status(403).json({ message: 'Access denied: Not an admin' });

    // Token version kill switch (supports `v` or `tokenVersion` in JWT)
    const tokVer =
      typeof decoded.v === 'number'
        ? decoded.v
        : typeof decoded.tokenVersion === 'number'
        ? decoded.tokenVersion
        : undefined;

    if (typeof admin.tokenVersion === 'number' && typeof tokVer === 'number' && tokVer !== admin.tokenVersion) {
      return res.status(401).json({ message: 'Token no longer valid. Please sign in again.' });
    }

    // Invalidate if password changed after token was issued
    if (decoded.iat && admin.passwordUpdatedAt) {
      const iatMs = decoded.iat * 1000;
      if (iatMs < new Date(admin.passwordUpdatedAt).getTime()) {
        return res.status(401).json({ message: 'Session expired (password changed). Please sign in again.' });
      }
    }

    // Attach normalized admin (no password)
    req.admin = {
      ...admin,
      roles,
      role: roles[0] || null,
      perms: Array.isArray(admin.perms) ? admin.perms : [],
    };
    // For any legacy middleware that checks req.user
    req.user = req.admin;

    return next();
  } catch (err) {
    console.error('❌ Admin auth failed:', err?.message || err);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

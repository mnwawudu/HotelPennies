// routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');

// Strong password check
const isStrong = (pwd = '') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

// ─────────────────────────────────────────
// POST /api/admin/login
// ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // IMPORTANT: include password explicitly if schema uses select:false
    const admin = await Admin.findOne({ email }).select('+password +role +tokenVersion');
    if (!admin) return res.status(400).json({ message: 'Invalid credentials' });

    const hash = admin.password;
    if (typeof hash !== 'string' || !hash.startsWith('$2')) {
      // No/invalid hash on this admin row
      console.error('⚠️ Admin has no valid password hash in DB:', email);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const payload = { id: admin._id, role: admin.role || 'admin', v: admin.tokenVersion || 0 };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name || admin.username || 'Admin',
        email: admin.email,
        role: admin.role || 'admin',
      },
    });
  } catch (err) {
    console.error('❌ Admin login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────
// POST /api/admin/change-password  (protected)
// body: { currentPassword, newPassword }
// ─────────────────────────────────────────
router.post('/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include upper, lower, and a number.',
      });
    }

    // Re-load with password + tokenVersion
    const admin = await Admin.findById(req.admin._id).select('+password +tokenVersion');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const hash = admin.password;
    if (typeof hash !== 'string' || !hash.startsWith('$2')) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    const ok = await bcrypt.compare(currentPassword, hash);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    const sameAsOld = await bcrypt.compare(newPassword, hash);
    if (sameAsOld) {
      return res.status(400).json({ message: 'New password must differ from current password' });
    }

    // Let pre('save') hash + bump tokenVersion
    admin.password = newPassword;
    await admin.save();

    return res.json({ message: 'Password updated. Please sign in again.' });
  } catch (err) {
    console.error('❌ Admin change-password error:', err);
    return res.status(500).json({ message: 'Could not update password' });
  }
});

/**
 * ─────────────────────────────────────────
 * ONE-TIME SETUP/REPAIR ENDPOINT (guarded)
 * POST /api/admin/_setup/set-password
 * headers:  X-Setup-Token: <ADMIN_SETUP_TOKEN>
 * body:     { email, password }
 * Use ONLY to fix an admin that has no password hash.
 * Remove/disable after use.
 * ─────────────────────────────────────────
 */
router.post('/_setup/set-password', async (req, res) => {
  try {
    const setupToken = req.headers['x-setup-token'] || req.body?.setupToken;
    if (!process.env.ADMIN_SETUP_TOKEN || setupToken !== process.env.ADMIN_SETUP_TOKEN) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');

    if (!email || !password) return res.status(400).json({ message: 'email and password required' });
    if (!isStrong(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include upper, lower, and a number.',
      });
    }

    const admin = await Admin.findOne({ email }).select('+password +tokenVersion');
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    admin.password = password; // pre('save') will hash + bump tokenVersion
    await admin.save();

    return res.json({ ok: true, message: 'Password set for admin.' });
  } catch (err) {
    console.error('❌ Setup set-password error:', err);
    return res.status(500).json({ message: 'Failed to set password' });
  }
});

module.exports = router;

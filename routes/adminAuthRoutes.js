// routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth'); // ✅ protect admin-only routes

// ✅ Admin login route (unchanged)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  console.log('🚨 Incoming login request:', email);

  try {
    const admin = await Admin.findOne({ email });
    console.log('👀 Fetched Admin from DB:', admin);

    if (!admin) {
      console.log('❌ Admin not found');
      return res.status(400).json({ message: 'Invalid credentials (email not found)' });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    console.log('🔐 Password match result:', isMatch);

    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(400).json({ message: 'Invalid credentials (wrong password)' });
    }

    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (err) {
    console.error('❌ Server error during admin login:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ───────────────────────────────────────────────────────────────
// ✅ Admin change password (requires adminAuth)
// POST /api/admin/change-password
// body: { currentPassword, newPassword }
// ───────────────────────────────────────────────────────────────
const isStrong = (pwd = '') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

router.post('/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 chars and include upper, lower, and a number.',
      });
    }

    // adminAuth already attached req.admin
    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    // prevent reusing the same password
    const sameAsOld = await bcrypt.compare(newPassword, admin.password);
    if (sameAsOld) {
      return res.status(400).json({ message: 'New password must differ from current password' });
    }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    return res.json({ message: 'Password updated successfully. Please sign in again.' });
  } catch (err) {
    console.error('❌ Admin change-password error:', err);
    res.status(500).json({ message: 'Could not update password' });
  }
});

module.exports = router;

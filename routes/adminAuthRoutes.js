// routes/adminAuthRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');

const isStrong = (pwd='') => pwd.length>=8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const admin = await Admin.findOne({ email });
    if (!admin) return res.status(400).json({ message: 'Invalid credentials (email not found)' });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials (wrong password)' });

    const token = jwt.sign(
      { id: admin._id, role: admin.role, v: Number(admin.tokenVersion || 0) },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (e) {
    console.error('Admin login error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Change password (must be logged in)
router.post('/change-password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Both currentPassword and newPassword are required' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({ message: 'Password must be ≥8 chars and include upper, lower, and a number.' });
    }

    const admin = await Admin.findById(req.admin._id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const ok = await bcrypt.compare(currentPassword, admin.password);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    const same = await bcrypt.compare(newPassword, admin.password);
    if (same) return res.status(400).json({ message: 'New password must differ from current password' });

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save(); // bumps tokenVersion via pre-save

    res.json({ message: 'Password updated successfully. Please sign in again.' });
  } catch (e) {
    console.error('Admin change-password error:', e);
    res.status(500).json({ message: 'Could not update password' });
  }
});

module.exports = router;

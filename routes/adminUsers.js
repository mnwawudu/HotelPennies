// routes/adminUsers.js
const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole');

const router = express.Router();
const STRONG = (p='') => p.length>=8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);

// List admins (superadmin only)
router.get('/admins', adminAuth, adminRole(['superadmin']), async (_req, res) => {
  const rows = await Admin.find().select('_id email username role createdAt updatedAt').lean();
  res.json(rows);
});

// Create admin (superadmin only)
router.post('/admins', adminAuth, adminRole(['superadmin']), async (req, res) => {
  try {
    const { email, password, role='staff', username } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'email and password are required' });
    if (!['staff','manager','superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    if (!STRONG(password)) return res.status(400).json({ message: 'Weak password' });

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ message: 'Admin with this email already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const admin = await Admin.create({
      email,
      username: username || email.split('@')[0],
      role,
      password: hashed
    });

    res.status(201).json({ id: admin._id, email: admin.email, role: admin.role });
  } catch (e) {
    console.error('Create admin error:', e);
    res.status(500).json({ message: 'Failed to create admin' });
  }
});

// Update role (superadmin only)
router.patch('/admins/:id/role', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body || {};
  if (!['staff','manager','superadmin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }
  const doc = await Admin.findByIdAndUpdate(id, { role }, { new: true });
  if (!doc) return res.status(404).json({ message: 'Admin not found' });
  res.json({ id: doc._id, email: doc.email, role: doc.role });
});

// Reset password (superadmin only)
router.post('/admins/:id/reset-password', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body || {};
  if (!STRONG(newPassword)) return res.status(400).json({ message: 'Weak password' });

  const admin = await Admin.findById(id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const salt = await bcrypt.genSalt(10);
  admin.password = await bcrypt.hash(newPassword, salt); // pre-save will bump tokenVersion
  await admin.save();

  res.json({ message: 'Password reset' });
});

module.exports = router;

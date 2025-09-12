// routes/adminUsers.js
const express = require('express');
const router = express.Router();

const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // adminRole(['allowed','roles'])

/* GET /api/admin/admin-users */
router.get('/admin-users', adminAuth, adminRole(['superadmin','manager']), async (req, res) => {
  const rows = await Admin.find().select('name email role createdAt').sort({ createdAt: -1 }).lean();
  res.json({ items: rows });
});

/* POST /api/admin/admin-users */
router.post('/admin-users', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { name, email, password, role = 'staff', sendInvite = false } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'name, email, password are required' });

  const exists = await Admin.findOne({ email });
  if (exists) return res.status(400).json({ message: 'Email already exists' });

  const doc = new Admin({ name, email, role, password });
  await doc.save();

  // optional invite email
  if (sendInvite) {
    try {
      const mailer = require('../services/mailer'); // safe no-op if you don’t use it
      await mailer.sendAdminInvite(email, name);
    } catch (_) { /* ignore */ }
  }

  res.status(201).json({ id: doc._id, message: 'Admin created' });
});

/* POST /api/admin/admin-users/:id/reset-password */
router.post('/admin-users/:id/reset-password', adminAuth, adminRole(['superadmin','manager']), async (req, res) => {
  const { id } = req.params;
  const admin = await Admin.findById(id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  const token = admin.issuePasswordResetToken();
  await admin.save();

  try {
    const mailer = require('../services/mailer');
    await mailer.sendAdminReset(admin.email, admin.name || 'Admin', token);
  } catch (_) { /* ignore */ }

  res.json({ message: 'Reset email sent (if SMTP configured)' });
});

/* DELETE /api/admin/admin-users/:id */
router.delete('/admin-users/:id', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { id } = req.params;
  await Admin.findByIdAndDelete(id);
  res.json({ message: 'Deleted' });
});

module.exports = router;

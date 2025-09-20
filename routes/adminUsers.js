// routes/adminUsers.js
const express = require('express');
const router = express.Router();

const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // adminRole(['allowed','roles'])

// normalize helpers
const normEmail = (e) => String(e || '').trim().toLowerCase();

/* GET /api/admin/admin-users */
router.get(
  '/admin-users',
  adminAuth,
  adminRole(['superadmin', 'manager']),
  async (_req, res) => {
    try {
      const rows = await Admin.find()
        .select('name email role createdAt')
        .sort({ createdAt: -1 })
        .lean();
      res.json({ items: rows });
    } catch (_e) {
      res.status(500).json({ message: 'Failed to list admin users' });
    }
  }
);

/* POST /api/admin/admin-users */
router.post(
  '/admin-users',
  adminAuth,
  adminRole(['superadmin']),
  async (req, res) => {
    try {
      const { name, email, password, role = 'staff', sendInvite = false } = req.body || {};
      if (!name || !email || !password) {
        return res.status(400).json({ message: 'name, email, password are required' });
      }

      const e = normEmail(email);
      const exists = await Admin.findOne({ email: e });
      if (exists) return res.status(400).json({ message: 'Email already exists' });

      const doc = new Admin({ name: String(name).trim(), email: e, role, password });
      await doc.save();

      // optional invite email (non-blocking)
      if (sendInvite) {
        try {
          const mailer = require('../services/mailer');
          await mailer.sendAdminInvite(e, name);
        } catch {
          // ignore email errors to avoid leaking info; creation still succeeds
        }
      }

      res.status(201).json({ id: doc._id, message: 'Admin created' });
    } catch (_e) {
      res.status(500).json({ message: 'Failed to create admin' });
    }
  }
);

/* POST /api/admin/admin-users/:id/reset-password */
router.post(
  '/admin-users/:id/reset-password',
  adminAuth,
  adminRole(['superadmin', 'manager']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const admin = await Admin.findById(id);
      if (!admin) return res.status(404).json({ message: 'Admin not found' });

      const token = admin.issuePasswordResetToken();
      await admin.save();

      try {
        const mailer = require('../services/mailer');
        await mailer.sendAdminReset(admin.email, admin.name || 'Admin', token);
      } catch {
        // ignore email errors; do not reveal whether address exists
      }

      res.json({ message: 'Reset email sent (if SMTP configured)' });
    } catch (_e) {
      res.status(500).json({ message: 'Failed to reset password' });
    }
  }
);

/* DELETE /api/admin/admin-users/:id */
router.delete(
  '/admin-users/:id',
  adminAuth,
  adminRole(['superadmin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      await Admin.findByIdAndDelete(id);
      res.json({ message: 'Deleted' });
    } catch (_e) {
      res.status(500).json({ message: 'Failed to delete admin' });
    }
  }
);

module.exports = router;

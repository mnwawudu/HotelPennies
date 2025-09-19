// routes/adminUsers.js
const express = require('express');
const router = express.Router();

const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // adminRole(['allowed','roles'])

// ✅ startup banner so we know this legacy router is loaded
console.log('LEGACY adminUsers routes LOADED ✅');

// ✅ optional per-request tracer so we can see which router handled it
router.use((req, _res, next) => {
  // Only trace the relevant endpoints to keep logs clean
  if (/^\/admin-users(\/|$)/.test(req.path)) {
    req.__traceId = `ADMUSR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
    console.log(`[${req.__traceId}] [adminUsers] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// normalize helpers
const normEmail = (e) => String(e || '').trim().toLowerCase();

/* GET /api/admin/admin-users */
router.get('/admin-users', adminAuth, adminRole(['superadmin','manager']), async (req, res) => {
  try {
    const rows = await Admin.find()
      .select('name email role createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items: rows });
  } catch (e) {
    console.error('[adminUsers][list] error:', e?.message || e);
    res.status(500).json({ message: 'Failed to list admin users' });
  }
});

/* POST /api/admin/admin-users */
router.post('/admin-users', adminAuth, adminRole(['superadmin']), async (req, res) => {
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

    // optional invite email
    if (sendInvite) {
      try {
        const mailer = require('../services/mailer');
        // For legacy compatibility, this will also issue a token inside if needed
        await mailer.sendAdminInvite(e, name);
        console.log('[adminUsers][create] invite sent to', e);
      } catch (err) {
        console.error('[adminUsers][create] invite error:', err?.message || err);
        // do not fail creation for email issues
      }
    }

    res.status(201).json({ id: doc._id, message: 'Admin created' });
  } catch (e) {
    console.error('[adminUsers][create] error:', e?.message || e);
    res.status(500).json({ message: 'Failed to create admin' });
  }
});

/* POST /api/admin/admin-users/:id/reset-password */
router.post('/admin-users/:id/reset-password', adminAuth, adminRole(['superadmin','manager']), async (req, res) => {
  const traceId = req.__traceId || `ADMUSR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  try {
    const { id } = req.params;
    const admin = await Admin.findById(id);
    if (!admin) {
      console.warn(`[${traceId}] [adminUsers][reset] not found:`, id);
      return res.status(404).json({ message: 'Admin not found' });
    }

    console.log(`[${traceId}] [adminUsers][reset] issuing token for`, admin.email);
    const token = admin.issuePasswordResetToken();
    await admin.save();

    try {
      const mailer = require('../services/mailer');
      await mailer.sendAdminReset(admin.email, admin.name || 'Admin', token);
      console.log(`[${traceId}] [adminUsers][reset] reset mail sent to`, admin.email);
    } catch (err) {
      console.error(`[${traceId}] [adminUsers][reset] mail error:`, {
        message: err?.message,
        code: err?.code,
        command: err?.command,
        responseCode: err?.responseCode,
        response: err?.response,
      });
      // Still return generic OK to avoid email enumeration
    }

    res.json({ message: 'Reset email sent (if SMTP configured)' });
  } catch (e) {
    console.error(`[${traceId}] [adminUsers][reset] error:`, e?.message || e);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

/* DELETE /api/admin/admin-users/:id */
router.delete('/admin-users/:id', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const traceId = req.__traceId || `ADMUSR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  try {
    const { id } = req.params;
    await Admin.findByIdAndDelete(id);
    console.log(`[${traceId}] [adminUsers][delete] deleted`, id);
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error(`[${traceId}] [adminUsers][delete] error:`, e?.message || e);
    res.status(500).json({ message: 'Failed to delete admin' });
  }
});

module.exports = router;

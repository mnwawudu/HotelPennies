// routes/adminAccountsRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // (unused here but harmless)
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // gate by role

// ✅ use the same mailer as the rest of the app
const { send, FROM_EMAIL } = require('../services/mailer');

const ROLES = ['staff','manager','superadmin'];
const isStrong = (pwd='') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);

/**
 * Email helpers
 * We DO NOT build a new transport here. We reuse services/mailer.js -> send()
 * so this route behaves exactly like registration and other working emails.
 */

// Choose admin-facing base URL (prefer explicit admin app URL if set)
function getBaseUrl() {
  // Keep your existing FRONTEND_BASE_URL fallback to avoid behavioral change
  return (
    process.env.ADMIN_APP_URL ||
    process.env.FRONTEND_BASE_URL ||
    'https://www.hotelpennies.com'
  ).replace(/\/+$/, '');
}

async function sendInviteEmail(to, name, token) {
  if (!to || !token) return;

  const base = getBaseUrl();
  const link = `${base}/admin/set-password?token=${encodeURIComponent(token)}`;
  const replyTo = process.env.REPLY_TO || undefined;

  try {
    console.log('📧 About to send admin invite/reset email to', to, 'link:', link);
    await send({
      to,
      from: FROM_EMAIL, // consistent with your working mail sender
      ...(replyTo ? { replyTo } : {}),
      subject: 'You’ve been granted HotelPennies admin access',
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
          <p>Hi ${name || ''},</p>
          <p>You now have admin access to HotelPennies.</p>
          <p><a href="${link}" style="display:inline-block;background:#0b5;color:#fff;padding:.7rem 1rem;border-radius:6px;text-decoration:none;">Click here to set your password</a></p>
          <p>This link is valid for 60 minutes.</p>
          <p>If you didn’t expect this, ignore this email.</p>
        </div>
      `,
    });
    console.log('✅ Admin invite/reset email sent to', to);
  } catch (e) {
    console.error('❌ Invite/reset email failed:', e?.message || e);
  }
}

// LIST admins (manager/superadmin)
router.get('/admin-users', adminAuth, adminRole(['manager','superadmin']), async (req, res) => {
  const rows = await Admin.find({})
    .select('_id name email role createdAt')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ items: rows });
});

// CREATE admin (superadmin only)
router.post('/admin-users', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { name='', email='', role='staff', password='', sendInvite=false } = req.body || {};
  const e = String(email).trim().toLowerCase();
  const r = String(role).toLowerCase();

  if (!e) return res.status(400).json({ message: 'Email is required' });
  if (!ROLES.includes(r)) return res.status(400).json({ message: 'Invalid role' });
  if (!isStrong(password)) return res.status(400).json({ message: 'Weak password (min 8, upper, lower, number)' });

  const exists = await Admin.findOne({ email: e }).lean();
  if (exists) return res.status(409).json({ message: 'Email already in use' });

  const admin = new Admin({ name: name.trim(), email: e, role: r, password });
  await admin.save();

  if (sendInvite) {
    const raw = admin.issuePasswordResetToken();
    await admin.save();
    await sendInviteEmail(admin.email, admin.name, raw);
  }

  res.status(201).json({ id: admin._id, name: admin.name, email: admin.email, role: admin.role, createdAt: admin.createdAt });
});

// RESET password email (manager/superadmin)
router.post('/admin-users/:id/reset-password', adminAuth, adminRole(['manager','superadmin']), async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  console.log('🔐 Admin reset requested for', admin.email);

  const raw = admin.issuePasswordResetToken();
  await admin.save();

  try {
    console.log('📧 Pre-send for', admin.email);
    await sendInviteEmail(admin.email, admin.name, raw);
    console.log('✅ Post-send for', admin.email);
  } catch (err) {
    console.error('❌ Reset email error for', admin.email, err?.message || err);
  }

  res.json({ ok: true });
});

// DELETE admin (superadmin only, cannot delete self)
router.delete('/admin-users/:id', adminAuth, adminRole(['superadmin']), async (req, res) => {
  if (String(req.params.id) === String(req.admin._id)) {
    return res.status(400).json({ message: 'You cannot delete your own admin account' });
  }
  const del = await Admin.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ message: 'Admin not found' });
  res.json({ ok: true });
});

module.exports = router;

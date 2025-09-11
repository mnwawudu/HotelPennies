// routes/adminAccountsRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // gate by role

const ROLES = ['staff','manager','superadmin'];
const isStrong = (pwd='') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);

// mailer (no-throw: logs on failure)
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
async function sendInviteEmail(to, name, token) {
  const transport = getTransport();
  if (!transport) return;
  const base = process.env.FRONTEND_BASE_URL || 'https://www.hotelpennies.com';
  const link = `${base}/admin/set-password?token=${encodeURIComponent(token)}`;
  const from = process.env.FROM_EMAIL || 'HotelPennies <admin@hotelpennies.com>';
  const replyTo = process.env.REPLY_TO || undefined;

  try {
    await transport.sendMail({
      to,
      from,
      ...(replyTo ? { replyTo } : {}),
      subject: 'You’ve been granted HotelPennies admin access',
      html: `
        <p>Hi ${name || ''},</p>
        <p>You now have admin access to HotelPennies.</p>
        <p><a href="${link}">Click here to set your password</a>. This link is valid for 60 minutes.</p>
        <p>If you didn’t expect this, ignore this email.</p>
      `,
    });
  } catch (e) {
    console.warn('Invite email failed:', e.message);
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
  const raw = admin.issuePasswordResetToken();
  await admin.save();
  await sendInviteEmail(admin.email, admin.name, raw);
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

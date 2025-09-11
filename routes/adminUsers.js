// routes/adminUsers.js
const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole');
const sendMail = require('../utils/mail');

// helpers
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || 'https://www.hotelpennies.com';
const VALID_ROLES = new Set(['superadmin', 'manager', 'staff']);

function makeInviteUrl(email, token) {
  const qs = new URLSearchParams({ email, token }).toString();
  return `${FRONTEND_BASE}/admin/set-password?${qs}`;
}

async function issueInvite(adminDoc) {
  const token = adminDoc.issuePasswordResetToken(); // sets hash & expiry on doc
  await adminDoc.save();

  const inviteUrl = makeInviteUrl(adminDoc.email, token);
  const subject = 'HotelPennies — Admin invite';
  const html = `
    <p>Hello ${adminDoc.username || 'there'},</p>
    <p>You’ve been invited as an <strong>${adminDoc.role}</strong> on HotelPennies.</p>
    <p>Click the button below to set your password:</p>
    <p><a href="${inviteUrl}" style="background:#0a2a66;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Set Password</a></p>
    <p>Or open this link:<br/><code>${inviteUrl}</code></p>
    <p>This link expires in 60 minutes.</p>
  `;
  try {
    await sendMail({ to: adminDoc.email, subject, html });
  } catch (e) {
    console.warn('⚠️ invite email failed; share link manually:', inviteUrl, e?.message || e);
  }
  return inviteUrl;
}

// ───────────── GET /api/admin/users  (list admins) ─────────────
router.get('/users', adminAuth, adminRole(['superadmin']), async (_req, res) => {
  const rows = await Admin.find({})
    .select('_id username email role createdAt resetTokenExpires')
    .sort({ createdAt: -1 })
    .lean();
  res.json(
    rows.map(r => ({
      id: r._id,
      name: r.username || '',
      email: r.email,
      role: r.role,
      createdAt: r.createdAt,
      invitePending: !!(r.resetTokenExpires && r.resetTokenExpires > new Date()),
    }))
  );
});

// ───────── POST /api/admin/users/invite  (create + invite) ───────
router.post('/users/invite', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const { name = '', email = '', role = '' } = req.body || {};
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanRole  = String(role).trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Valid email is required' });
  }
  if (!VALID_ROLES.has(cleanRole)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  let admin = await Admin.findOne({ email: cleanEmail });
  if (admin) {
    return res.status(409).json({ message: 'Admin already exists. Use “Resend Invite”.' });
  }

  // Create with a random password (user will set a new one via invite)
  const tempPassword = crypto.randomBytes(16).toString('hex');
  admin = await Admin.create({
    username: name || cleanEmail.split('@')[0],
    email: cleanEmail,
    role: cleanRole,
    password: tempPassword,
  });

  const inviteUrl = await issueInvite(admin);
  return res.status(201).json({ id: admin._id, inviteUrl });
});

// ───────── POST /api/admin/users/:id/invite  (resend) ────────────
router.post('/users/:id/invite', adminAuth, adminRole(['superadmin']), async (req, res) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return res.status(404).json({ message: 'Admin not found' });
  const inviteUrl = await issueInvite(admin);
  res.json({ inviteUrl });
});

// ───────── DELETE /api/admin/users/:id  (delete) ────────────────
router.delete('/users/:id', adminAuth, adminRole(['superadmin']), async (req, res) => {
  if (String(req.admin._id) === String(req.params.id)) {
    return res.status(400).json({ message: "You can't delete yourself." });
  }
  const out = await Admin.findByIdAndDelete(req.params.id);
  if (!out) return res.status(404).json({ message: 'Admin not found' });
  res.json({ ok: true });
});

// ───────── POST /api/admin/set-password  (finish invite) ─────────
router.post('/set-password', async (req, res) => {
  const { email = '', token = '', newPassword = '' } = req.body || {};
  const cleanEmail = String(email).trim().toLowerCase();

  if (!cleanEmail || !token || !newPassword) {
    return res.status(400).json({ message: 'email, token and newPassword are required' });
  }
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ message: 'Weak password. Use 8+ chars with upper, lower and a number.' });
  }

  const admin = await Admin.findOne({ email: cleanEmail }).select('+resetTokenHash');
  if (!admin) return res.status(404).json({ message: 'Admin not found' });

  if (!admin.resetTokenHash || !admin.resetTokenExpires || admin.resetTokenExpires < new Date()) {
    return res.status(400).json({ message: 'Invite link expired. Ask for a new invite.' });
  }

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  if (hash !== admin.resetTokenHash) {
    return res.status(400).json({ message: 'Invalid token' });
  }

  await admin.setPassword(newPassword); // pre-save hook bumps tokenVersion
  admin.resetTokenHash = undefined;
  admin.resetTokenExpires = undefined;
  await admin.save();

  // auto-login after setting password
  const jwt = require('jsonwebtoken');
  const tkn = jwt.sign({ id: admin._id, role: 'admin', v: admin.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1d' });

  res.json({
    message: 'Password set. You are signed in.',
    token: tkn,
    admin: { id: admin._id, name: admin.username, email: admin.email, role: admin.role }
  });
});

module.exports = router;

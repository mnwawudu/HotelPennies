// routes/adminAccountsRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // (unused here but harmless)
const Admin = require('../models/adminModel');
const adminAuth = require('../middleware/adminAuth');
const adminRole = require('../middleware/adminRole'); // gate by role

// ✅ reuse the shared mailer used everywhere else
const { send, FROM_EMAIL } = require('../services/mailer');

// ✅ startup banner so we know these routes are loaded in this service
console.log('ADMIN-ACCOUNTS ROUTES LOADED ✅');

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
    throw e; // bubble so caller can log traceId context
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
    try {
      await sendInviteEmail(admin.email, admin.name, raw);
    } catch (_) {
      // already logged; do not fail creation because of email
    }
  }

  res.status(201).json({ id: admin._id, name: admin.name, email: admin.email, role: admin.role, createdAt: admin.createdAt });
});

// RESET password email (manager/superadmin)
router.post('/admin-users/:id/reset-password', adminAuth, adminRole(['manager','superadmin']), async (req, res) => {
  // 👇 add a traceId for this request so UI ↔ server logs match perfectly
  const traceId = `RST-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  console.log(`[${traceId}] 🔔 Hit reset-password route`, { id: req.params.id, by: req?.admin?.email });

  const admin = await Admin.findById(req.params.id);
  if (!admin) {
    console.warn(`[${traceId}] Admin not found`);
    return res.status(404).json({ ok: false, message: 'Admin not found', traceId });
  }

  console.log(`[${traceId}] 🔐 Admin reset requested for ${admin.email}`);
  const raw = admin.issuePasswordResetToken();
  await admin.save();

  try {
    console.log(`[${traceId}] 📧 Pre-send for ${admin.email}`);
    await sendInviteEmail(admin.email, admin.name, raw);
    console.log(`[${traceId}] ✅ Post-send for ${admin.email}`);
  } catch (err) {
    console.error(`[${traceId}] ❌ Reset email error for ${admin.email}`, {
      message: err?.message,
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
      response: err?.response,
    });
    // still return ok to avoid user enumeration, but include traceId for debugging
  }

  const debug = String(process.env.MAIL_DEBUG || '').toLowerCase() === 'true';
  return res.json(debug ? { ok: true, traceId } : { ok: true });
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

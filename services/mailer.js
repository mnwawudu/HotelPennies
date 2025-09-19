// services/mailer.js
// One shared Nodemailer transport for the whole app (SMTP-first, Gmail fallback)
// Back-compat helpers for legacy routes: sendAdminInvite, sendAdminReset

const nodemailer = require('nodemailer');

const MAIL_DEBUG = String(process.env.MAIL_DEBUG || '').toLowerCase() === 'true';

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

function buildTransport() {
  const userEnv = (process.env.SMTP_USER || process.env.SMTP_LOGIN || '').trim();
  const passEnv = (process.env.SMTP_PASS || '').trim();

  // Prefer explicit SMTP (your domain mailbox)
  if (process.env.SMTP_HOST && userEnv && passEnv) {
    const host   = process.env.SMTP_HOST;
    const port   = Number(process.env.SMTP_PORT || 587);
    const secure = toBool(process.env.SMTP_SECURE) || port === 465;
    const user   = userEnv;
    const pass   = passEnv;

    console.log('[MAIL] Using SMTP', { host, port, secure, user });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,                       // false for 587 (STARTTLS), true for 465
      auth: { user, pass },
      logger: MAIL_DEBUG,
      debug: MAIL_DEBUG,
      tls: MAIL_DEBUG ? { rejectUnauthorized: false } : undefined, // relax only in debug
      greetingTimeout: 10000,
      connectionTimeout: 10000,
      socketTimeout: 20000,
    });

    transporter.verify()
      .then(() => {
        console.log('📬 SMTP transport verified');
        console.log('[MAIL] SMTP READY ✅', { host, port, secure, user });
      })
      .catch(err => console.warn('⚠️  SMTP verify warning:', err?.message || err));

    if (MAIL_DEBUG) {
      transporter.on('error', err => console.error('✉️  SMTP transport error:', err));
    }
    return transporter;
  }

  // Fallback to Gmail App Password if configured
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('[MAIL] Using Gmail SMTP (smtp.gmail.com:465, secure=true)');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: (process.env.GMAIL_USER || '').trim(),
        pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
      },
      logger: MAIL_DEBUG,
      debug: MAIL_DEBUG,
    });

    transporter.verify()
      .then(() => {
        console.log('📬 Gmail transport verified');
        console.log('[MAIL] SMTP READY ✅', { host: 'smtp.gmail.com', port: 465, secure: true, user: (process.env.GMAIL_USER || '').trim() });
      })
      .catch(err => console.warn('⚠️  Gmail verify warning:', err?.message || err));

    if (MAIL_DEBUG) {
      transporter.on('error', err => console.error('✉️  Gmail transport error:', err));
    }
    return transporter;
  }

  console.warn('[MAIL] No SMTP/Gmail credentials found. Using jsonTransport (logs only).');
  return nodemailer.createTransport({ jsonTransport: true, logger: MAIL_DEBUG, debug: MAIL_DEBUG });
}

// Build once
const transporter = buildTransport();

// Nice default From header
const FROM_EMAIL =
  process.env.FROM_EMAIL
  || (process.env.SMTP_USER ? `HotelPennies <${process.env.SMTP_USER}>`
      : process.env.GMAIL_USER ? `HotelPennies <${process.env.GMAIL_USER}>`
      : 'HotelPennies <no-reply@hotelpennies.com>');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || undefined;

// Base URL for admin set-password/reset pages
function getBaseUrl() {
  return (
    process.env.ADMIN_APP_URL ||
    process.env.FRONTEND_BASE_URL ||
    'https://www.hotelpennies.com'
  ).replace(/\/+$/, '');
}

/** Core sender so callers can do: await send({to, subject, text, html}) */
async function send({ to, subject, text, html, bcc, cc, attachments }) {
  if (MAIL_DEBUG) {
    console.log('[MAIL][REQ]', { to, subject, hasHtml: !!html, hasText: !!text, from: FROM_EMAIL });
  }
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      ...(bcc ? { bcc } : {}),
      ...(cc ? { cc } : {}),
      subject,
      text,
      html,
      attachments,
    });
    console.log('[MAIL] sent', {
      to,
      messageId: info?.messageId,
      accepted: info?.accepted,
      rejected: info?.rejected,
      response: info?.response,
    });
    return info;
  } catch (err) {
    console.error('[MAIL] ERROR', {
      code: err?.code,
      command: err?.command,
      responseCode: err?.responseCode,
      response: err?.response,
      message: err?.message,
    });
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Back-compat helpers expected by legacy routes/adminUsers.js         */
/* ------------------------------------------------------------------ */

/**
 * sendAdminInvite(to, name)
 * If no token is present, issues a token for the Admin by email and sends the invite link.
 */
async function sendAdminInvite(to, name) {
  const base = getBaseUrl();
  let token = null;

  try {
    // Lazy-load to avoid circular deps at module load time
    const Admin = require('../models/adminModel');
    const admin = await Admin.findOne({ email: String(to).toLowerCase().trim() });
    if (!admin) {
      console.warn('[MAIL] sendAdminInvite: admin not found for', to);
      return;
    }
    token = admin.issuePasswordResetToken();
    await admin.save();
  } catch (e) {
    console.warn('[MAIL] sendAdminInvite: could not issue token (continuing only if route passed one):', e?.message || e);
  }

  const link = `${base}/admin/set-password?token=${encodeURIComponent(token || '')}`;
  const subject = 'You’ve been granted HotelPennies admin access';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
      <p>Hi ${name || 'Admin'},</p>
      <p>You now have admin access to HotelPennies.</p>
      <p><a href="${link}" style="display:inline-block;background:#0b5;color:#fff;padding:.7rem 1rem;border-radius:6px;text-decoration:none;">Click here to set your password</a></p>
      <p>This link is valid for 60 minutes.</p>
      <p>If you didn’t expect this, ignore this email.</p>
    </div>
  `;

  await send({ to, subject, html });
}

/**
 * sendAdminReset(to, name, token?)
 * Uses provided token if given; otherwise issues a new token for the admin and sends reset link.
 */
async function sendAdminReset(to, name, token) {
  const base = getBaseUrl();
  let raw = token;

  if (!raw) {
    try {
      const Admin = require('../models/adminModel');
      const admin = await Admin.findOne({ email: String(to).toLowerCase().trim() });
      if (!admin) {
        console.warn('[MAIL] sendAdminReset: admin not found for', to);
        return;
      }
      raw = admin.issuePasswordResetToken();
      await admin.save();
    } catch (e) {
      console.error('[MAIL] sendAdminReset: failed to issue token:', e?.message || e);
      throw e;
    }
  }

  const link = `${base}/admin/set-password?token=${encodeURIComponent(raw)}`;
  const subject = 'Reset your Admin password - HotelPennies';
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
      <h2>Admin Password Reset</h2>
      <p>Hi ${name || 'Admin'},</p>
      <p>Click the button below to reset your password:</p>
      <p><a href="${link}" style="display:inline-block;background:#0b5;color:#fff;padding:.7rem 1rem;border-radius:6px;text-decoration:none;">Reset Password</a></p>
      <p>If the button doesn't work, copy and paste this link:</p>
      <p><a href="${link}">${link}</a></p>
      <hr/>
      <p style="color:#666;font-size:.9rem;">From: ${FROM_EMAIL}</p>
    </div>
  `;

  await send({ to, subject, html });
}

module.exports = {
  transporter,
  FROM_EMAIL,
  ADMIN_EMAIL,
  send,
  // back-compat exports for legacy routers:
  sendAdminInvite,
  sendAdminReset,
};

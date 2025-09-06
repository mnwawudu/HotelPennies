// services/mailer.js
// One shared Nodemailer transport for the whole app (SMTP-first, Gmail fallback)

const nodemailer = require('nodemailer');

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

function buildTransport() {
  // Prefer explicit SMTP (your domain mailbox)
  if (process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_LOGIN) && process.env.SMTP_PASS) {
    const host   = process.env.SMTP_HOST;
    const port   = Number(process.env.SMTP_PORT || 587);
    const secure = toBool(process.env.SMTP_SECURE) || port === 465;
    const user   = process.env.SMTP_USER || process.env.SMTP_LOGIN;
    const pass   = process.env.SMTP_PASS;

    console.log('[MAIL] Using SMTP', { host, port, secure });
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    // Non-fatal warmup (some hosts don’t like verify; we log and continue)
    transporter.verify()
      .then(() => console.log('📬 SMTP transport verified'))
      .catch(err => console.warn('⚠️  SMTP verify warning:', err?.message || err));

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
        user: process.env.GMAIL_USER,
        pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''), // strip spaces
      },
    });

    transporter.verify()
      .then(() => console.log('📬 Gmail transport verified'))
      .catch(err => console.warn('⚠️  Gmail verify warning:', err?.message || err));

    return transporter;
  }

  console.warn('[MAIL] No SMTP/Gmail credentials found. Falling back to jsonTransport (logs only).');
  return nodemailer.createTransport({ jsonTransport: true }); // doesn’t send; logs the email JSON
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

/** Small helper so callers can do: await send({to, subject, text, html}) */
async function send({ to, subject, text, html, bcc, cc, attachments }) {
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
  console.log('[MAIL] sent', { to, messageId: info?.messageId });
  return info;
}

module.exports = {
  transporter,
  FROM_EMAIL,
  ADMIN_EMAIL,
  send,
};

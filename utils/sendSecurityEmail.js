// Robust, single-transport mailer used by auth routes (and elsewhere)
const nodemailer = require('nodemailer');

let TRANSPORT = null;
let VERIFIED = false;

function buildTransport() {
  // Prefer explicit SMTP_* if provided
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(port) === '465';
    console.log('[MAIL] using SMTP → host:', process.env.SMTP_HOST, 'port:', port, 'secure:', secure);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback to Gmail App Password (you already set these in .env)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('[MAIL] using Gmail SMTP (smtp.gmail.com:465, secure=true)');
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  console.error('[MAIL] No SMTP creds found. Set SMTP_* or GMAIL_USER/GMAIL_APP_PASSWORD.');
  return null;
}

async function ensureTransport() {
  if (!TRANSPORT) TRANSPORT = buildTransport();
  if (!TRANSPORT) return false;

  if (VERIFIED) return true;
  try {
    await TRANSPORT.verify();
    VERIFIED = true;
    console.log('[MAIL] transport verified.');
    return true;
  } catch (e) {
    console.error('[MAIL] transport verify failed:', e?.message || e);
    VERIFIED = false;
    return false;
  }
}

module.exports = async function sendSecurityEmail({ to, subject, text, html }) {
  const ok = await ensureTransport();
  if (!ok) throw new Error('Mail transport not ready (check SMTP/Gmail credentials).');

  const from =
    process.env.FROM_EMAIL ||
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    'no-reply@hotelpennies.com';

  const info = await TRANSPORT.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });

  console.log('[MAIL] sent messageId:', info?.messageId, 'to:', to);
  return info;
};

// services/mailer.js
const nodemailer = require('nodemailer');

const MAIL_DEBUG = String(process.env.MAIL_DEBUG || '').toLowerCase() === 'true';

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

function buildTransport() {
  if (process.env.SMTP_HOST && (process.env.SMTP_USER || process.env.SMTP_LOGIN) && process.env.SMTP_PASS) {
    const host   = process.env.SMTP_HOST;
    const port   = Number(process.env.SMTP_PORT || 587);
    const secure = toBool(process.env.SMTP_SECURE) || port === 465;
    const user   = process.env.SMTP_USER || process.env.SMTP_LOGIN;

    console.log('[MAIL] Using SMTP', { host, port, secure, user });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,                       // false for 587 (STARTTLS), true for 465
      auth: { user, pass: process.env.SMTP_PASS },
      logger: MAIL_DEBUG,           // 👈 extra logs
      debug: MAIL_DEBUG,            // 👈 extra logs
      tls: MAIL_DEBUG ? { rejectUnauthorized: false } : undefined, // relax only in debug
      greetingTimeout: 10000,
      connectionTimeout: 10000,
      socketTimeout: 20000,
    });

    transporter.verify()
      .then(() => console.log('📬 SMTP transport verified'))
      .catch(err => console.warn('⚠️  SMTP verify warning:', err?.message || err));

    if (MAIL_DEBUG) {
      transporter.on('error', err => console.error('✉️  SMTP transport error:', err));
    }
    return transporter;
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('[MAIL] Using Gmail SMTP (smtp.gmail.com:465, secure=true)');
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, ''),
      },
      logger: MAIL_DEBUG,
      debug: MAIL_DEBUG,
    });

    transporter.verify()
      .then(() => console.log('📬 Gmail transport verified'))
      .catch(err => console.warn('⚠️  Gmail verify warning:', err?.message || err));

    if (MAIL_DEBUG) {
      transporter.on('error', err => console.error('✉️  Gmail transport error:', err));
    }
    return transporter;
  }

  console.warn('[MAIL] No SMTP/Gmail credentials found. Using jsonTransport (logs only).');
  return nodemailer.createTransport({ jsonTransport: true, logger: MAIL_DEBUG, debug: MAIL_DEBUG });
}

const transporter = buildTransport();

const FROM_EMAIL =
  process.env.FROM_EMAIL
  || (process.env.SMTP_USER ? `HotelPennies <${process.env.SMTP_USER}>`
      : process.env.GMAIL_USER ? `HotelPennies <${process.env.GMAIL_USER}>`
      : 'HotelPennies <no-reply@hotelpennies.com>');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || undefined;

async function send({ to, subject, text, html, bcc, cc, attachments }) {
  if (MAIL_DEBUG) {
    console.log('[MAIL][REQ]', { to, subject, hasHtml: !!html, hasText: !!text, from: FROM_EMAIL });
  }
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
}

module.exports = { transporter, FROM_EMAIL, ADMIN_EMAIL, send };

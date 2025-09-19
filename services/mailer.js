// services/mailer.js
// One shared Nodemailer transport for the whole app (SMTP-first, Gmail fallback)

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
      logger: MAIL_DEBUG,           // extra logs
      debug: MAIL_DEBUG,            // extra logs
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

module.exports = {
  transporter,
  FROM_EMAIL,
  ADMIN_EMAIL,
  send,
};

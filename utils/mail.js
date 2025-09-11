// utils/mail.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL
} = process.env;

let transporter = null;

if (SMTP_HOST && SMTP_PORT && (SMTP_USER || SMTP_PASS)) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: (SMTP_USER || SMTP_PASS) ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

async function sendMail({ to, subject, html, text }) {
  if (!transporter) {
    console.warn('📭 SMTP not configured. Email skipped. To:', to, 'Subject:', subject);
    return;
  }
  await transporter.sendMail({
    from: FROM_EMAIL || 'no-reply@hotelpennies.com',
    to, subject, html, text: text || html?.replace(/<[^>]+>/g, '')
  });
}

module.exports = sendMail;

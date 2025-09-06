// utils/sendVerificationEmail.js
// Sends the verification email using the shared SMTP transport
const { send, FROM_EMAIL, ADMIN_EMAIL } = require('../services/mailer');

async function sendVerificationEmail(email, name, activationLink) {
  if (!email || !activationLink) {
    throw new Error('sendVerificationEmail requires { email, activationLink }');
  }

  const safeName = (name || '').trim();
  const subject = 'Verify Your Email - HotelPennies';

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6;">
      <h2>Welcome to HotelPennies 🎉</h2>
      <p>${safeName ? `Hi ${safeName},` : 'Hello,'}</p>
      <p>Thanks for registering. Please verify your email by clicking the button below:</p>
      <p style="margin:18px 0;">
        <a href="${activationLink}"
           style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0a3d62;color:#fff;text-decoration:none;font-weight:700;">
          Verify Email
        </a>
      </p>
      <p>If the button doesn’t work, copy and paste this link:</p>
      <p style="word-break:break-all;"><a href="${activationLink}">${activationLink}</a></p>
      <p style="margin-top:24px;">If you didn’t request this, you can ignore this message.</p>
      <p>— HotelPennies Team</p>
    </div>
  `;

  const text = [
    `Welcome to HotelPennies${safeName ? `, ${safeName}` : ''}!`,
    ``,
    `Please verify your email by opening this link:`,
    activationLink,
    ``,
    `If you didn’t request this, you can ignore this message.`,
    `— HotelPennies Team`,
  ].join('\n');

  console.log('📧 Sending verification email to:', email);
  await send({
    to: email,
    bcc: ADMIN_EMAIL, // harmless if undefined
    subject,
    text,
    html,
  });
}

module.exports = sendVerificationEmail;

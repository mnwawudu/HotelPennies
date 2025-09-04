// ✅ utils/sendVerificationEmail.js
const nodemailer = require('nodemailer');

const sendVerificationEmail = async (email, name, activationLink) => {
  // Prefer your existing .env keys; fall back to legacy names if present
  const user =
    process.env.GMAIL_USER ||
    process.env.EMAIL_USERNAME; // fallback

  const pass =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.EMAIL_PASSWORD; // fallback

  if (!user || !pass) {
    // Surface a clear error so you don't get a silent 500
    throw new Error(
      'Email credentials missing: set GMAIL_USER and GMAIL_APP_PASSWORD in .env (or EMAIL_USERNAME / EMAIL_PASSWORD).'
    );
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  const fromAddress = `"HotelPennies" <${user}>`;
  const adminBcc = process.env.ADMIN_EMAIL || undefined; // optional BCC if you set it

  const mailOptions = {
    from: fromAddress,
    to: email,
    bcc: adminBcc, // harmless if undefined
    subject: 'Verify Your Email - HotelPennies',
    html: `
      <div style="font-family:sans-serif; line-height:1.6;">
        <h2>Welcome to HotelPennies 🎉</h2>
        <p>Thank you for registering. Please verify your email by clicking the button below:</p>
        <p>
          <a href="${activationLink}"
             style="display:inline-block;padding:10px 20px;background:#001f3f;color:#fff;text-decoration:none;border-radius:4px">
            Verify Email
          </a>
        </p>
        <p>If the button doesn’t work, copy and paste this link into your browser:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <br />
        <p>If you didn’t request this, please ignore this email.</p>
        <p>— HotelPennies Team</p>
      </div>
    `,
  };

  // Log who we're sending to (helps debug)
  console.log('📧 Sending verification to:', email);

  await transporter.sendMail(mailOptions);
};

module.exports = sendVerificationEmail;

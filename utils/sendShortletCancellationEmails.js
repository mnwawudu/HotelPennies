const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('⚠️  GMAIL_USER or GMAIL_APP_PASSWORD missing. Emails will fail to send.');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// non-fatal warm-up check
transporter.verify()
  .then(() => console.log('📬 Gmail SMTP ready'))
  .catch(err => console.warn('⚠️  SMTP verify failed:', err.message));

const sendShortletCancellationEmails = async ({
  userEmail, vendorEmail, adminEmail, shortletName, fullName, phone, checkIn, checkOut, guests
}) => {
  const subject = `🚫 Shortlet Booking Canceled - ${shortletName}`;
  const text = `
Hello,

This is to notify you that a shortlet booking has been canceled.

🏠 Shortlet: ${shortletName}
👤 Guest Name: ${fullName}
📞 Phone: ${phone}
📧 Email: ${userEmail}
📅 Check-in: ${checkIn}
📅 Check-out: ${checkOut}
👥 Guests: ${guests}

Please update your records.

Thanks,
HotelPennies Team
`.trim();

  const mailOptions = {
    from: `"HotelPennies" <${GMAIL_USER}>`,
    to: userEmail,
    bcc: [vendorEmail, adminEmail].filter(Boolean),
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Shortlet cancellation emails sent.');
  } catch (error) {
    console.error('❌ Failed to send shortlet cancellation emails:', error);
  }
};

module.exports = sendShortletCancellationEmails;

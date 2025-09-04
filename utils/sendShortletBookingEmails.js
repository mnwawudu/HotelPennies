const nodemailer = require('nodemailer');

const GMAIL_USER = process.env.GMAIL_USER || '';
// strip spaces from app password (Google shows it spaced in UI)
const GMAIL_APP_PASSWORD = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('⚠️  GMAIL_USER or GMAIL_APP_PASSWORD missing. Emails will fail to send.');
}

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // SSL
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

// non-fatal warm-up check
transporter.verify()
  .then(() => console.log('📬 Gmail SMTP ready'))
  .catch(err => console.warn('⚠️  SMTP verify failed:', err.message));

const sendShortletBookingEmails = async ({
  userEmail, vendorEmail, adminEmail, shortletName, fullName, phone, checkIn, checkOut, guests
}) => {
  const subject = `🏠 Shortlet Booking Confirmed - ${shortletName}`;
  const text = `
Hello,

A new booking has been made for the shortlet "${shortletName}".

👤 Guest Name: ${fullName}
📞 Phone: ${phone}
📧 Email: ${userEmail}
📅 Check-in: ${checkIn}
📅 Check-out: ${checkOut}
👥 Guests: ${guests}

Please keep this email for your records.

Thanks,
HotelPennies Team
`.trim();

  const mailOptions = {
    from: `"HotelPennies" <${GMAIL_USER}>`, // must be the authenticated Gmail or an allowed alias
    to: userEmail,
    bcc: [vendorEmail, adminEmail].filter(Boolean),
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Shortlet booking confirmation emails sent.');
  } catch (error) {
    console.error('❌ Failed to send shortlet booking emails:', error);
  }
};

module.exports = sendShortletBookingEmails;

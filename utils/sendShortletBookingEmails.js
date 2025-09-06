// utils/sendShortletBookingEmails.js
// Uses shared transporter from services/mailer (SMTP or json fallback)
const { transporter, FROM_EMAIL, ADMIN_EMAIL } = require('../services/mailer');

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

async function sendShortletBookingEmails({
  userEmail,
  vendorEmail,
  adminEmail,
  shortletName,
  fullName,
  phone,
  checkIn,
  checkOut,
  guests,
}) {
  if (!userEmail) {
    console.warn('📭 sendShortletBookingEmails: no userEmail provided; skipping send.');
    return false;
  }

  const subject = `🏠 Shortlet Booking Confirmed - ${shortletName || 'Shortlet'}`;
  const text = `
Hello,

A new booking has been made for the shortlet "${shortletName || 'Shortlet'}".

👤 Guest Name: ${fullName || '-'}
📞 Phone: ${phone || '-'}
📧 Email: ${userEmail}
📅 Check-in: ${checkIn || '-'}
📅 Check-out: ${checkOut || '-'}
👥 Guests: ${guests ?? '-'}

Please keep this email for your records.

Thanks,
HotelPennies Team
`.trim();

  const bccList = [
    ...asArray(vendorEmail),
    ...asArray(adminEmail || ADMIN_EMAIL),
  ].filter(Boolean);

  try {
    await transporter.sendMail({
      from: FROM_EMAIL, // already includes display name if configured in services/mailer
      to: userEmail,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text,
    });
    console.log('✅ Shortlet booking confirmation emails sent.');
    return true;
  } catch (error) {
    console.error('❌ Failed to send shortlet booking emails:', error?.message || error);
    return false;
  }
}

module.exports = sendShortletBookingEmails;

// utils/sendShortletCancellationEmails.js
// Uses shared transporter from services/mailer (SMTP or json fallback)
const { transporter, FROM_EMAIL, ADMIN_EMAIL } = require('../services/mailer');

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

async function sendShortletCancellationEmails({
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
    console.warn('📭 sendShortletCancellationEmails: no userEmail provided; skipping send.');
    return false;
  }

  const subject = `🚫 Shortlet Booking Canceled - ${shortletName || 'Shortlet'}`;
  const text = `
Hello,

This is to notify you that a shortlet booking has been canceled.

🏠 Shortlet: ${shortletName || 'Shortlet'}
👤 Guest Name: ${fullName || '-'}
📞 Phone: ${phone || '-'}
📧 Email: ${userEmail}
📅 Check-in: ${checkIn || '-'}
📅 Check-out: ${checkOut || '-'}
👥 Guests: ${guests ?? '-'}

Please update your records.

Thanks,
HotelPennies Team
`.trim();

  const bccList = [
    ...asArray(vendorEmail),
    ...asArray(adminEmail || ADMIN_EMAIL),
  ].filter(Boolean);

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to: userEmail,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text,
    });
    console.log('✅ Shortlet cancellation emails sent.');
    return true;
  } catch (error) {
    console.error('❌ Failed to send shortlet cancellation emails:', error?.message || error);
    return false;
  }
}

module.exports = sendShortletCancellationEmails;

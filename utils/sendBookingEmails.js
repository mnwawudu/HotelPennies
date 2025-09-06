// utils/sendBookingEmails.js
// Uses shared transporter from services/mailer (SMTP or json fallback)
const { transporter, FROM_EMAIL, ADMIN_EMAIL } = require('../services/mailer');

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Send booking confirmation / notification emails.
 * Backward compatible with previous params.
 */
async function sendBookingNotifications(params = {}) {
  const {
    category = 'Hotel',

    // recipient variants:
    to,
    userEmail,          // preferred
    email,              // legacy echo

    // optional BCCs:
    bcc,
    vendorEmail,
    adminEmail,

    // display fields:
    hotelName,
    shortletName,
    title,
    subTitle,
    vendorName,
    fullName,
    phone,
    checkIn,
    checkOut,
    reservationTime,
    eventDate,
    tourDate,
    guests,
    price,
    paymentReference,
    notes,
  } = params;

  const primaryTo = (userEmail || to || email || '').trim();
  if (!primaryTo) {
    console.warn('📭 sendBookingNotifications: no recipient email; skipping send.');
    return false;
  }

  const bccList = [
    ...asArray(bcc),
    ...asArray(vendorEmail),
    ...asArray(adminEmail || ADMIN_EMAIL),
  ].filter(Boolean);

  const nameForSubject = title || hotelName || shortletName || category;
  const subject = `🏨 Booking Confirmed - ${nameForSubject}`;

  const fmtDate = (d) => {
    try {
      if (!d) return '';
      const dd = new Date(d);
      return dd.toLocaleString();
    } catch {
      return String(d);
    }
  };

  const lines = [
    `Hello${fullName ? ` ${fullName}` : ''},`,
    ``,
    `Your ${category.toLowerCase()} booking has been confirmed.`,
    ``,
    `🏨 ${category}: ${nameForSubject}`,
  ];
  if (subTitle) lines.push(`🏷️ Room/Item: ${subTitle}`);
  if (vendorName) lines.push(`🏢 Vendor: ${vendorName}`);
  if (fullName) lines.push(`👤 Name: ${fullName}`);
  if (phone) lines.push(`📞 Phone: ${phone}`);
  if (email) lines.push(`📧 Email: ${email}`);

  if (checkIn) lines.push(`📅 Check-in: ${fmtDate(checkIn)}`);
  if (checkOut) lines.push(`📅 Check-out: ${fmtDate(checkOut)}`);
  if (reservationTime) lines.push(`🕒 Reservation: ${fmtDate(reservationTime)}`);
  if (eventDate) lines.push(`🗓️ Event Date: ${fmtDate(eventDate)}`);
  if (tourDate) lines.push(`🗺️ Tour Date: ${fmtDate(tourDate)}`);
  if (guests != null) lines.push(`👥 Guests: ${guests}`);
  if (notes && String(notes).trim()) lines.push(`📝 Notes: ${String(notes).trim()}`);
  if (price != null) lines.push(`💵 Amount: ₦${Number(price).toLocaleString()}`);
  if (paymentReference) lines.push(`🔖 Payment Ref: ${paymentReference}`);

  lines.push('', 'Thanks for using HotelPennies!', 'HotelPennies Team');

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,           // already includes display name if configured
      to: primaryTo,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text: lines.join('\n'),
    });
    console.log('✅ Booking email sent.');
    return true;
  } catch (err) {
    console.error('❌ Failed to send booking email:', err?.message || err);
    return false;
  }
}

module.exports = sendBookingNotifications;

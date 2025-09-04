// utils/sendBookingEmails.js
const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.GMAIL_USER;
const FROM_NAME =
  process.env.GMAIL_FROM_NAME && String(process.env.GMAIL_FROM_NAME).trim()
    ? process.env.GMAIL_FROM_NAME.trim()
    : 'HotelPennies';

// Strip spaces in case the app password was pasted like "xxxx xxxx xxxx xxxx"
const APP_PASS = String(process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

if (!FROM_EMAIL) console.warn('⚠️ GMAIL_USER is not set — emails cannot be sent.');
if (!APP_PASS) console.warn('⚠️ GMAIL_APP_PASSWORD is not set — Gmail transporter will fail to authenticate.');

// Simple Gmail transporter (same style as the working shortlet mailers)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: FROM_EMAIL, pass: APP_PASS },
});

/**
 * Send hotel booking confirmation email.
 * Mirrors the working shortlet approach, but keeps params flexible so existing calls still work.
 *
 * Accepts either { to } or { userEmail } as the primary recipient.
 * BCCs vendor/admin if provided.
 */
async function sendBookingNotifications(params = {}) {
  if (!FROM_EMAIL || !APP_PASS) return false;

  const {
    // common/legacy fields we’ve seen across your codebase:
    category = 'Hotel',
    to,                 // optional
    bcc,                // optional (string or array)
    userEmail,          // preferred “to”
    vendorEmail,        // optional bcc
    adminEmail,         // optional bcc

    // display fields
    hotelName,
    shortletName,
    title,
    subTitle,           // e.g., room name
    vendorName,
    fullName,
    phone,
    email,              // echo back to user
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
    console.warn('📭 sendBookingNotifications(hotel): no recipient email; skipping send.');
    return false;
  }

  // Build BCC list like the shortlet mailers
  const bccList = []
    .concat(Array.isArray(bcc) ? bcc : bcc ? [bcc] : [])
    .concat(vendorEmail ? [vendorEmail] : [])
    .concat(adminEmail ? [adminEmail] : [])
    .filter(Boolean);

  // Pick the best visible name for the subject
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

  const textLines = [
    `Hello${fullName ? ` ${fullName}` : ''},`,
    '',
    `Your ${category.toLowerCase()} booking has been confirmed.`,
    '',
    `🏨 ${category}: ${nameForSubject}`,
  ];
  if (subTitle) textLines.push(`🏷️ Room/Item: ${subTitle}`);
  if (vendorName) textLines.push(`🏢 Vendor: ${vendorName}`);
  if (fullName) textLines.push(`👤 Name: ${fullName}`);
  if (phone) textLines.push(`📞 Phone: ${phone}`);
  if (email) textLines.push(`📧 Email: ${email}`);

  if (checkIn) textLines.push(`📅 Check-in: ${fmtDate(checkIn)}`);
  if (checkOut) textLines.push(`📅 Check-out: ${fmtDate(checkOut)}`);
  if (reservationTime) textLines.push(`🕒 Reservation: ${fmtDate(reservationTime)}`);
  if (eventDate) textLines.push(`🗓️ Event Date: ${fmtDate(eventDate)}`);
  if (tourDate) textLines.push(`🗺️ Tour Date: ${fmtDate(tourDate)}`);
  if (guests) textLines.push(`👥 Guests: ${guests}`);
  if (notes && String(notes).trim()) textLines.push(`📝 Notes: ${String(notes).trim()}`);
  if (price != null) textLines.push(`💵 Amount: ₦${Number(price).toLocaleString()}`);
  if (paymentReference) textLines.push(`🔖 Payment Ref: ${paymentReference}`);

  textLines.push('', 'Thanks for using HotelPennies!', 'HotelPennies Team');

  const text = textLines.join('\n');

  try {
    await transporter.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: primaryTo,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text,
    });
    console.log('✅ Hotel booking confirmation email sent.');
    return true;
  } catch (error) {
    console.error('❌ Failed to send hotel booking email:', error);
    return false;
  }
}

module.exports = sendBookingNotifications;

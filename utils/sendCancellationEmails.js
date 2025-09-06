// utils/sendCancellationEmails.js
// Uses shared transporter from services/mailer (SMTP or json fallback)
const { transporter, FROM_EMAIL, ADMIN_EMAIL } = require('../services/mailer');

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

const fmtDate = (d) => {
  try {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // calendar-day
    const dd = new Date(d);
    return Number.isNaN(dd.getTime()) ? String(d) : dd.toLocaleString();
  } catch {
    return String(d);
  }
};

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttribute(str = '') {
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/**
 * Send cancellation notifications to user (To) and optionally vendor/admin (BCC).
 */
async function sendCancellationEmails({
  category = 'Booking',
  userEmail,
  vendorEmail,
  adminEmail,
  title = '',
  subTitle = '',
  fullName,
  phone,
  checkIn,
  checkOut,
  eventDate,        // Date/ISO fallback
  eventDateLocal,   // 'YYYY-MM-DD'
  tourDate,         // Date/ISO fallback
  tourDateLocal,    // 'YYYY-MM-DD'
  guests,
  cancelLink,       // optional CTA link
}) {
  if (!userEmail) {
    console.warn('⚠️ sendCancellationEmails: userEmail not provided — skipping send.');
    return false;
  }

  const subject = `🚫 ${category} Booking Canceled - ${title || category}`;

  const eventStr = eventDateLocal || fmtDate(eventDate);
  const tourStr  = tourDateLocal  || fmtDate(tourDate);

  const textLines = [
    `Hello,`,
    ``,
    `This is to notify you that a ${category.toLowerCase()} booking has been canceled.`,
    ``,
    `📌 ${category}: ${title || category}`,
  ];
  if (subTitle) textLines.push(`🏨 Item: ${subTitle}`);
  if (fullName) textLines.push(`👤 Guest Name: ${fullName}`);
  if (phone) textLines.push(`📞 Phone: ${phone}`);
  if (userEmail) textLines.push(`📧 Email: ${userEmail}`);
  if (eventStr) textLines.push(`🗓️ Event Date: ${eventStr}`);
  if (tourStr)  textLines.push(`🗺️ Tour Date: ${tourStr}`);
  if (checkIn)  textLines.push(`📅 Check-in: ${fmtDate(checkIn)}`);
  if (checkOut) textLines.push(`📅 Check-out: ${fmtDate(checkOut)}`);
  if (guests != null) textLines.push(`👥 Guests: ${guests}`);

  if (cancelLink) {
    textLines.push('', `🔗 Cancel instantly: ${cancelLink}`);
  }

  textLines.push('', 'Please update your records.', '', 'Thanks,', 'HotelPennies Team');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;">
      <p>Hello,</p>
      <p>This is to notify you that a ${escapeHtml(category.toLowerCase())} booking has been canceled.</p>
      <ul style="padding-left:18px;margin:10px 0;">
        <li><strong>${escapeHtml(category)}:</strong> ${escapeHtml(title || category)}</li>
        ${subTitle ? `<li><strong>Item:</strong> ${escapeHtml(subTitle)}</li>` : ''}
        ${fullName ? `<li><strong>Guest:</strong> ${escapeHtml(fullName)}</li>` : ''}
        ${phone ? `<li><strong>Phone:</strong> ${escapeHtml(phone)}</li>` : ''}
        ${userEmail ? `<li><strong>Email:</strong> ${escapeHtml(userEmail)}</li>` : ''}
        ${eventStr ? `<li><strong>Event date:</strong> ${escapeHtml(eventStr)}</li>` : ''}
        ${tourStr ? `<li><strong>Tour date:</strong> ${escapeHtml(tourStr)}</li>` : ''}
        ${checkIn ? `<li><strong>Check-in:</strong> ${escapeHtml(fmtDate(checkIn))}</li>` : ''}
        ${checkOut ? `<li><strong>Check-out:</strong> ${escapeHtml(fmtDate(checkOut))}</li>` : ''}
        ${guests != null ? `<li><strong>Guests:</strong> ${escapeHtml(String(guests))}</li>` : ''}
      </ul>

      ${cancelLink ? `
        <p style="margin:18px 0;">
          <a href="${escapeAttribute(cancelLink)}" style="display:inline-block;padding:12px 16px;border-radius:8px;background:#0a3d62;color:#fff;text-decoration:none;font-weight:700;">
            Cancel booking
          </a>
        </p>
        <p style="font-size:13px">If the button doesn’t work, copy and paste this URL:</p>
        <p style="word-break:break-all;"><a href="${escapeAttribute(cancelLink)}">${escapeHtml(cancelLink)}</a></p>
      ` : ''}

      <p>Please update your records.</p>
      <p>Thanks,<br/>HotelPennies Team</p>
    </div>
  `;

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
      text: textLines.join('\n'),
      html,
    });
    console.log('✅ Cancellation emails sent.');
    return true;
  } catch (error) {
    console.error('❌ Failed to send cancellation emails:', error?.message || error);
    return false;
  }
}

/**
 * Send a one-click guest cancellation magic-link email.
 */
async function sendCancelMagicLinkEmail({
  to,
  link,
  category = 'Booking',
  title = '',
  paymentReference,
  adminEmail,
}) {
  if (!to || !link) {
    throw new Error('sendCancelMagicLinkEmail requires { to, link }');
  }

  const subject = `🔗 Cancel your ${category} booking${title ? ` – ${title}` : ''}`;

  const plain = [
    `Hello,`,
    ``,
    `You requested a secure link to cancel your ${category.toLowerCase()} booking${title ? ` (${title})` : ''}.`,
    paymentReference ? `Payment Reference: ${paymentReference}` : '',
    ``,
    `Click the link below to cancel immediately:`,
    link,
    ``,
    `If you did not request this, please ignore this email.`,
    ``,
    `Thanks,`,
    `HotelPennies Team`,
  ].filter(Boolean).join('\n');

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;">
      <p>Hello,</p>
      <p>
        You requested a secure link to cancel your ${escapeHtml(category.toLowerCase())} booking${
          title ? ` (<strong>${escapeHtml(title)}</strong>)` : ''
        }.
        ${paymentReference ? `<br/>Payment Reference: <strong>${escapeHtml(paymentReference)}</strong>` : ''}
      </p>
      <p style="margin:20px 0;">
        <a href="${escapeAttribute(link)}" style="display:inline-block;background:#0a3d62;color:#fff;text-decoration:none;padding:12px 16px;border-radius:8px;font-weight:700;">
          Cancel booking
        </a>
      </p>
      <p>If the button doesn’t work, copy and paste this URL into your browser:</p>
      <p style="word-break:break-all;"><a href="${escapeAttribute(link)}">${escapeHtml(link)}</a></p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Thanks,<br/>HotelPennies Team</p>
    </div>
  `;

  const bccList = asArray(adminEmail || ADMIN_EMAIL).filter(Boolean);

  try {
    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text: plain,
      html,
    });
    console.log('✅ Guest cancel magic link email sent.');
    return true;
  } catch (err) {
    console.error('❌ Failed to send guest cancel magic link email:', err?.message || err);
    throw err;
  }
}

module.exports = sendCancellationEmails;
module.exports.sendCancelMagicLinkEmail = sendCancelMagicLinkEmail;

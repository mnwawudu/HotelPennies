// utils/sendCancellationEmails.js
const nodemailer = require('nodemailer');

const FROM_EMAIL = process.env.GMAIL_USER;
const FROM_NAME =
  process.env.GMAIL_FROM_NAME && String(process.env.GMAIL_FROM_NAME).trim()
    ? process.env.GMAIL_FROM_NAME.trim()
    : 'HotelPennies';

if (!FROM_EMAIL) {
  console.warn('⚠️ GMAIL_USER is not set — emails cannot be sent.');
}
if (!process.env.GMAIL_APP_PASSWORD) {
  console.warn('⚠️ GMAIL_APP_PASSWORD is not set — Gmail transporter will fail to authenticate.');
}

// Create a single reusable transporter (Gmail with App Password)
let transporter;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: FROM_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD, // App Password (not regular Gmail password)
    },
  });
  return transporter;
}

// ---------- Small helpers ----------
/**
 * Returns a nice date string:
 * - If given 'YYYY-MM-DD', returns it untouched (that's our canonical calendar-day).
 * - Otherwise tries to format as local date-time.
 */
const fmtDate = (d) => {
  try {
    if (!d) return '';
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d; // calendar-day string
    const dd = new Date(d);
    if (Number.isNaN(dd.getTime())) return String(d);
    return dd.toLocaleString();
  } catch {
    return String(d);
  }
};

const asArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);

/**
 * Send cancellation notifications to user (To) and optionally vendor/admin (BCC).
 *
 * @param {Object} params
 * @param {string} [params.category='Booking'] - 'Hotel' | 'Shortlet' | 'Event Center' | 'Tour Guide' | ...
 * @param {string} params.userEmail - Recipient (user)
 * @param {string} [params.vendorEmail] - BCC (vendor)
 * @param {string} [params.adminEmail] - BCC (admin)
 * @param {string} [params.title] - Listing name (e.g., hotel/shortlet/event center/tour)
 * @param {string} [params.subTitle] - Sub item (e.g., room name)
 * @param {string} [params.fullName]
 * @param {string} [params.phone]
 * @param {Date|string} [params.checkIn]   - for hotels/shortlets
 * @param {Date|string} [params.checkOut]  - for hotels/shortlets
 * @param {Date|string} [params.eventDate] - Event Center date (Date or ISO)
 * @param {string}     [params.eventDateLocal] - Event Center local date 'YYYY-MM-DD' (preferred for emails)
 * @param {Date|string} [params.tourDate]  - Tour Guide date (Date or ISO)
 * @param {string}     [params.tourDateLocal] - Tour Guide local date 'YYYY-MM-DD' (preferred for emails)
 * @param {number|string} [params.guests]
 * @param {string}     [params.cancelLink] - 🔗 Optional magic-link URL to include in the email
 *
 * @returns {Promise<boolean>} true if sent, false otherwise
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
  eventDateLocal,   // 'YYYY-MM-DD' preferred
  tourDate,         // Date/ISO fallback
  tourDateLocal,    // 'YYYY-MM-DD' preferred
  guests,
  cancelLink,       // 🔗 NEW
}) {
  if (!FROM_EMAIL || !process.env.GMAIL_APP_PASSWORD) return false;
  if (!userEmail) {
    console.warn('⚠️ sendCancellationEmails: userEmail not provided — skipping send.');
    return false;
  }

  const subject = `🚫 ${category} Booking Canceled - ${title || category}`;

  const lines = [
    `Hello,`,
    ``,
    `This is to notify you that a ${category.toLowerCase()} booking has been canceled.`,
    ``,
    `📌 ${category}: ${title || category}`,
  ];
  if (subTitle) lines.push(`🏨 Item: ${subTitle}`);
  if (fullName) lines.push(`👤 Guest Name: ${fullName}`);
  if (phone) lines.push(`📞 Phone: ${phone}`);
  if (userEmail) lines.push(`📧 Email: ${userEmail}`);

  // ── Itinerary (category-specific) ──
  const eventStr = eventDateLocal || fmtDate(eventDate);
  const tourStr  = tourDateLocal  || fmtDate(tourDate);

  if (eventStr) lines.push(`🗓️ Event Date: ${eventStr}`);
  if (tourStr)  lines.push(`🗺️ Tour Date: ${tourStr}`);
  if (checkIn)  lines.push(`📅 Check-in: ${fmtDate(checkIn)}`);
  if (checkOut) lines.push(`📅 Check-out: ${fmtDate(checkOut)}`);
  if (guests)   lines.push(`👥 Guests: ${guests}`);

  // 🔗 Optional cancel link (button will be added in HTML too)
  if (cancelLink) {
    lines.push('');
    lines.push(`🔗 Cancel instantly: ${cancelLink}`);
  }

  lines.push('', 'Please update your records.', '', 'Thanks,', 'HotelPennies Team');

  const text = lines.join('\n');

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
        ${guests ? `<li><strong>Guests:</strong> ${escapeHtml(String(guests))}</li>` : ''}
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

  const bccList = [...asArray(vendorEmail), ...asArray(adminEmail)].filter(Boolean);

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: userEmail,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text,
      html,
    });
    console.log('✅ Cancellation emails sent.');
    return true;
  } catch (error) {
    console.error('❌ Failed to send cancellation emails:', error);
    return false;
  }
}

/**
 * Send a one-click guest cancellation magic link email.
 *
 * @param {Object} params
 * @param {string} params.to - Guest email (required)
 * @param {string} params.link - Absolute URL to /manage-booking-cancel?t=... (required)
 * @param {string} [params.category='Booking']
 * @param {string} [params.title=''] - Listing name (hotel/shortlet/event center)
 * @param {string} [params.paymentReference] - For user clarity
 * @param {string} [params.adminEmail] - Optional BCC to admin for audits
 *
 * @returns {Promise<boolean>} true if sent, throws on configuration error
 */
async function sendCancelMagicLinkEmail({
  to,
  link,
  category = 'Booking',
  title = '',
  paymentReference,
  adminEmail,
}) {
  if (!FROM_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error('Missing Gmail credentials (GMAIL_USER / GMAIL_APP_PASSWORD).');
  }
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
  ]
    .filter(Boolean)
    .join('\n');

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

  if (process.env.NODE_ENV !== 'production') {
    console.log('🔗 Debug cancel link (dev):', link);
  }

  const bccList = asArray(adminEmail).filter(Boolean);

  try {
    const t = getTransporter();
    await t.sendMail({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to,
      ...(bccList.length ? { bcc: bccList } : {}),
      subject,
      text: plain,
      html,
    });
    console.log('✅ Guest cancel magic link email sent.');
    return true;
  } catch (err) {
    console.error('❌ Failed to send guest cancel magic link email:', err);
    throw err;
  }
}

/* ------------------------ tiny HTML escaping helpers ------------------------ */
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function escapeAttribute(str = '') {
  // Slightly stricter for attributes/hrefs
  return escapeHtml(str).replace(/'/g, '&#39;');
}

/* ------------------------ Exports (backward compatible) --------------------- */
module.exports = sendCancellationEmails;
module.exports.sendCancelMagicLinkEmail = sendCancelMagicLinkEmail;

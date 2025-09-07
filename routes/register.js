// routes/register.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const PendingRegistration = require('../models/pendingRegistrationModel');
const { generateCode } = require('../utils/codeGenerator');

// ✅ Use unified mailer that supports SMTP or Gmail transparently
const sendSecurityEmail = require('../utils/sendSecurityEmail');

console.log('🔧 [register] route file loaded'); // fires on require()

// small helper to build a safe absolute URL for the FE
function buildFrontendUrl(path) {
  const rawBase =
    process.env.FRONTEND_BASE_URL ||
    process.env.FRONTEND_URL ||
    'https://www.hotelpennies.com'; // hard fallback so emails are always absolute

  // strip trailing slashes
  const base = String(rawBase).replace(/\/+$/, '');
  // ensure path starts with single slash
  const p = String(path || '').replace(/^\/*/, '/');
  return `${base}${p}`;
}

router.post('/register', async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    address,
    state = '',
    city = '',
    userType,            // 'user' | 'vendor'  (MUST be provided)
    businessTypes = [],  // array for vendors
  } = req.body;

  try {
    // 1) Validate required fields
    const role = String(userType || '').toLowerCase();
    if (!['user', 'vendor'].includes(role)) {
      return res.status(400).json({ message: 'Invalid user type' });
    }
    if (!name || !email || !password || !phone || !address) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Normalize
    const normEmail = String(email).trim().toLowerCase();
    const normPhone = String(phone).trim();

    // 2) Global uniqueness checks
    const [emailUser, emailVendor] = await Promise.all([
      User.findOne({ email: normEmail }).select('_id'),
      Vendor.findOne({ email: normEmail }).select('_id'),
    ]);
    if (emailUser || emailVendor) {
      return res.status(400).json({ message: 'Email is already in use' });
    }

    if (normPhone) {
      const [phoneUser, phoneVendor] = await Promise.all([
        User.findOne({ phone: normPhone }).select('_id'),
        Vendor.findOne({ phone: normPhone }).select('_id'),
      ]);
      if (phoneUser || phoneVendor) {
        return res.status(400).json({ message: 'Phone number is already in use' });
      }
    }

    // 3) Hash password now (never send plaintext)
    const passwordHash = await bcrypt.hash(String(password), 12);

    // 4) Create pending registration (includes state/city)
    const pending = await PendingRegistration.create({
      name: String(name || '').trim(),
      email: normEmail,
      phone: normPhone,
      address: String(address || '').trim(),
      state: String(state || '').trim(),
      city:  String(city  || '').trim(),
      userType: role,
      businessTypes: Array.isArray(businessTypes) ? businessTypes : [],
      passwordHash,
      // expiresAt handled by model default (24h TTL)
    });

    console.log(
      '🟢 [register] PendingRegistration created:',
      pending._id.toString(),
      normEmail,
      role
    );

    // 5) Build verification token with ONLY the JTI (pending _id)
    const verificationToken = jwt.sign(
      { jti: String(pending._id) },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // ✅ Always absolute, with your live domain fallback
    const activationLink = buildFrontendUrl(`/verify-email/${verificationToken}`);
    console.log('🔗 [register] activationLink:', activationLink);

    // 6) Send email via unified mailer (SMTP or Gmail)
    const subject = 'Verify Your Email - HotelPennies';
    const text = [
      `Hello ${name || ''},`,
      '',
      'Thank you for registering on HotelPennies.',
      'Please verify your email by opening the link below:',
      activationLink,
      '',
      'If you didn’t request this, you can ignore this email.',
      '',
      'HotelPennies Team',
    ].join('\n');

    const html = `
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
    `;

    try {
      await sendSecurityEmail({ to: normEmail, subject, text, html });
    } catch (mailErr) {
      // Clean up the pending doc if email couldn’t be sent
      await PendingRegistration.deleteOne({ _id: pending._id }).catch(() => {});
      console.error('📮 [register] email send failed, pending removed:', mailErr?.message || mailErr);
      return res.status(502).json({
        message: 'Could not send verification email. Please try again shortly.',
      });
    }

    // 7) Respond
    return res.status(200).json({
      message: 'Registration email sent. Please verify your email to activate your account.',
      token: verificationToken, // not used by UI, but retained for parity
    });
  } catch (err) {
    console.error('❌ [register] error:', err?.stack || err);
    return res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

module.exports = router;

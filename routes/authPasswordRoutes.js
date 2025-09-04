const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel'); // ⬅️ add vendor
const auth = require('../middleware/auth');
const sendSecurityEmail = require('../utils/sendSecurityEmail');

const router = express.Router();

// ───────────────── Rate limits ────────────────
const changeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const resetLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

// ───────────────── Helpers ────────────────────
const isStrong = (pwd = '') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

const FRONTEND_BASE =
  process.env.FRONTEND_BASE_URL ||
  process.env.FRONTEND_URL ||
  'http://localhost:3000';

const hash = (s='') => crypto.createHash('sha256').update(String(s)).digest('hex');

// ───────────────── Change password (logged in; works for user or vendor) ─────────────────
router.post('/change-password', auth, changeLimiter, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Missing currentPassword or newPassword' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 chars with upper, lower and number.',
      });
    }

    // auth middleware set req.user.role + _id
    const isVendor = req.user?.role === 'vendor';
    const Model = isVendor ? Vendor : User;

    // user model might store hash differently; both models expose verifyPassword()
    const subject = await Model.findById(req.user._id).select('+password');
    if (!subject) return res.status(401).json({ message: 'Unauthorized' });

    const ok = await subject.verifyPassword(currentPassword);
    if (!ok) return res.status(400).json({ message: 'Current password is incorrect' });

    if (await subject.verifyPassword(newPassword)) {
      return res.status(400).json({ message: 'New password must differ from current password' });
    }

    await subject.setPassword(newPassword);
    await subject.save(); // pre('save') bumps tokenVersion

    try {
      await sendSecurityEmail({
        to: subject.email,
        subject: 'Your HotelPennies password was changed',
        text: 'If you did not perform this change, please reset your password immediately.',
        html: `<p>Your password was just changed.</p>
               <p>If this wasn’t you, <a href="${FRONTEND_BASE}/forgot-password">reset it now</a>.</p>`,
      });
    } catch (e) {
      console.error('[change-password] email send failed:', e?.message || e);
    }

    res.json({ message: 'Password updated. Please sign in again.' });
  } catch (err) {
    console.error('[change-password] error:', err);
    res.status(500).json({ message: 'Could not change password' });
  }
});

// ───────────────── Forgot password (request token) — supports User or Vendor ─────────────
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(200).json({ message: 'If the email exists, you will get instructions.' });
    }
    const normEmail = String(email).toLowerCase();

    // Look up in both collections (no enumeration — always 200)
    const [user, vendor] = await Promise.all([
      User.findOne({ email: normEmail }),
      Vendor.findOne({ email: normEmail }),
    ]);
    const subject = user || vendor;

    if (subject) {
      const token = subject.issuePasswordResetToken(); // sets resetTokenHash/Expires
      await subject.save();

      const link =
        `${FRONTEND_BASE}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(subject.email)}`;

      console.info('[forgot-password] sending reset email →', subject.email, 'link:', link);

      try {
        await sendSecurityEmail({
          to: subject.email,
          subject: 'Reset your HotelPennies password',
          text: `Use this link to reset your password: ${link}`,
          html: `<p>Use this link to reset your password:</p>
                 <p><a href="${link}">${link}</a></p>
                 <p>This link expires in 60 minutes.</p>`,
        });
        console.info('[forgot-password] email queued OK for', subject.email);
      } catch (e) {
        console.error('[forgot-password] email send failed:', e?.message || e);
      }
    }

    res.status(200).json({ message: 'If the email exists, you will get instructions.' });
  } catch (err) {
    console.error('[forgot-password] error:', err);
    res.status(200).json({ message: 'If the email exists, you will get instructions.' });
  }
});

// ───────────────── Reset password (using token) — supports User or Vendor ────────────────
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const { email, token, newPassword } = req.body || {};
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Missing email, token, or newPassword' });
    }
    if (!isStrong(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 8 chars with upper, lower and number.',
      });
    }

    const normEmail = String(email).toLowerCase();
    // Try both models; whichever has a matching token wins.
    const [user, vendor] = await Promise.all([
      User.findOne({ email: normEmail }).select('+resetTokenHash resetTokenExpires'),
      Vendor.findOne({ email: normEmail }).select('+resetTokenHash resetTokenExpires'),
    ]);

    const tryReset = async (doc) => {
      if (!doc || !doc.resetTokenHash || !doc.resetTokenExpires) return false;
      const ok = (hash(token) === doc.resetTokenHash) && (doc.resetTokenExpires > new Date());
      if (!ok) return false;

      await doc.setPassword(newPassword);
      doc.resetTokenHash = undefined;
      doc.resetTokenExpires = undefined;
      await doc.save();

      try {
        await sendSecurityEmail({
          to: doc.email,
          subject: 'Your HotelPennies password was reset',
          text: 'If you did not request this reset, please contact support.',
          html: `<p>Your password was just reset.</p><p>If this wasn’t you, please contact support immediately.</p>`,
        });
      } catch (e) {
        console.error('[reset-password] email send failed:', e?.message || e);
      }
      return true;
    };

    if (await tryReset(user) || await tryReset(vendor)) {
      return res.json({ message: 'Password reset successful. Please sign in.' });
    }

    return res.status(400).json({ message: 'Invalid or expired reset token' });
  } catch (err) {
    console.error('[reset-password] error:', err);
    res.status(500).json({ message: 'Could not reset password' });
  }
});

module.exports = router;

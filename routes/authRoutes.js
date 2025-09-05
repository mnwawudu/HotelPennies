const express = require('express'); 
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const authMiddleware = require('../middleware/auth');
const sendSecurityEmail = require('../utils/sendSecurityEmail');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const isStrong = (pwd = '') =>
  pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /[0-9]/.test(pwd);

const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const resetLimiter  = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
const changeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Email/Password Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = null;
    let role = null;

    // Try finding as user first
    const foundUser = await User.findOne({ email });
    if (foundUser) {
      user = foundUser;
      role = 'user';
    } else {
      const foundVendor = await Vendor.findOne({ email });
      if (foundVendor) {
        user = foundVendor;
        role = 'vendor';
      } else {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('âœ… Login successful:', {
      email: user.email,
      role,
      id: user._id,
    });

    res.json({ token });
  } catch (err) {
    console.error('âŒ Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Google Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post('/auth/google', async (req, res) => {
  // âœ… NEW: safely accept optional state/city (wonâ€™t affect existing flows)
  const { token, referralCode, state, city } = req.body || {};

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      // Generate a unique 8-char code (no O/0/1/I)
      const genUserCode = async () => {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const make = () =>
          Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        for (let i = 0; i < 10; i++) {
          const candidate = make();
          const exists = await User.exists({ userCode: candidate });
          if (!exists) return candidate;
        }
        return `U${Date.now().toString(36).toUpperCase()}`;
      };

      const userCode = await genUserCode();
      const affiliateLink = `${process.env.FRONTEND_BASE_URL}/?ref=${userCode}`;

      user = new User({
        name: name || email.split('@')[0],
        email,
        // Pre-save hook will hash â€” placeholder only
        password: googleId,
        phone: '',
        address: '',
        // âœ… NEW (optional capture; harmless if empty)
        state: String(state || '').trim(),
        city:  String(city  || '').trim(),

        userCode,
        affiliateLink,
        isEmailVerified: true,
      });

      if (referralCode) {
        const ref = await User.findOne({ userCode: String(referralCode).toUpperCase() }).select('_id');
        if (ref) user.referredBy = ref._id;
      }

      await user.save();
    }

    const jwtToken = jwt.sign(
      { id: user._id, email: user.email, role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ token: jwtToken });
  } catch (error) {
    console.error('âŒ Google auth error:', error);
    return res.status(401).json({ message: 'Google login failed' });
  }
});


/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Change Password (logged-in user/vendor) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.put('/change-password', authMiddleware, changeLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Both current and new passwords are required' });
  }
  if (!isStrong(newPassword)) {
    return res.status(400).json({
      message: 'Password must be at least 8 chars with upper, lower and number.',
    });
  }

  try {
    const { role, _id } = req.user;
    const Model = role === 'vendor' ? Vendor : User;

    const user = await Model.findById(_id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    try {
      await sendSecurityEmail({
        to: user.email,
        subject: 'Your HotelPennies password was changed',
        text: 'If you did not perform this change, please reset your password immediately.',
        html: `<p>Your password was just changed.</p>
               <p>If this wasnâ€™t you, <a href="${process.env.FRONTEND_URL}/forgot-password">reset it now</a>.</p>`,
      });
    } catch (_) {}

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('âŒ Error changing password:', err);
    res.status(500).json({ message: 'Server error changing password' });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Forgot Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const generic = { message: 'If the email exists, you will get instructions.' };
    if (!email) return res.status(200).json(generic);

    const normalized = String(email).toLowerCase();
    let account = await User.findOne({ email: normalized });
    let accountType = 'user';

    if (!account) {
      account = await Vendor.findOne({ email: normalized });
      accountType = account ? 'vendor' : null;
    }

    if (account) {
      const raw = crypto.randomBytes(32).toString('hex');
      const hash = crypto.createHash('sha256').update(raw).digest('hex');
      account.resetTokenHash = hash;
      account.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);
      await account.save();

      const link = `${process.env.FRONTEND_URL}/reset-password?token=${raw}&email=${encodeURIComponent(account.email)}`;

      try {
        await sendSecurityEmail({
          to: account.email,
          subject: 'Reset your HotelPennies password',
          text: `Use this link to reset your password: ${link}`,
          html: `<p>Use this link to reset your password:</p>
                 <p><a href="${link}">${link}</a></p>
                 <p>This link expires in 60 minutes.</p>`,
        });
      } catch (_) {}
    }

    return res.status(200).json(generic);
  } catch (err) {
    console.error('âŒ [forgot-password] error:', err);
    return res.status(200).json({ message: 'If the email exists, you will get instructions.' });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Reset Password â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

    const normalized = String(email).toLowerCase();
    let account = await User.findOne({ email: normalized });
    let Model = User;
    if (!account) {
      account = await Vendor.findOne({ email: normalized });
      Model = Vendor;
    }
    if (!account || !account.resetTokenHash || !account.resetTokenExpires) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const valid = tokenHash === account.resetTokenHash && account.resetTokenExpires > new Date();
    if (!valid) return res.status(400).json({ message: 'Invalid or expired reset token' });

    account.password = newPassword;
    account.resetTokenHash = undefined;
    account.resetTokenExpires = undefined;
    await account.save();

    try {
      await sendSecurityEmail({
        to: account.email,
        subject: 'Your HotelPennies password was reset',
        text: 'If you did not request this reset, please contact support.',
        html: `<p>Your password was just reset.</p>
               <p>If this wasnâ€™t you, please contact support immediately.</p>`,
      });
    } catch (_) {}

    res.json({ message: 'Password reset successful. Please sign in.' });
  } catch (err) {
    console.error('âŒ [reset-password] error:', err);
    res.status(500).json({ message: 'Could not reset password' });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ NEW: Cross-collection phone availability â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get('/phone-available', async (req, res) => {
  try {
    const phone = String(req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ available: false, message: 'Missing phone' });
    const [u, v] = await Promise.all([
      User.findOne({ phone }).select('_id'),
      Vendor.findOne({ phone }).select('_id'),
    ]);
    return res.json({ available: !u && !v });
  } catch (err) {
    console.error('âŒ [phone-available] error:', err);
    return res.status(500).json({ available: false });
  }
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ NEW: Verification status for waiting tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
router.get('/verification-status', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ verified: false });

    const [user, vendor] = await Promise.all([
      User.findOne({ email }).select('isEmailVerified'),
      Vendor.findOne({ email }).select('isEmailVerified'),
    ]);

    if (user) return res.json({ verified: !!user.isEmailVerified, role: 'user' });
    if (vendor) return res.json({ verified: !!vendor.isEmailVerified, role: 'vendor' });
    return res.json({ verified: false });
  } catch (err) {
    console.error('âŒ [verification-status] error:', err);
    return res.status(500).json({ verified: false });
  }
});

module.exports = router;


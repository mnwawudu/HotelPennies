// routes/verifyEmail.js
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const router = express.Router();

const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const PendingRegistration = require('../models/pendingRegistrationModel');

console.log('🔧 [verify] route file loaded'); // fires on require()

const signAppToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;
  console.log('➡️  [verify] hit:', req.originalUrl, 'len(token)=', token?.length);

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔎 [verify] decoded:', decoded);

    // ── Preferred path: token has only { jti }
    if (decoded?.jti) {
      const jti = String(decoded.jti);
      const pending = await PendingRegistration.findById(jti).lean();
      console.log('🔎 [verify] pending exists?', !!pending, 'jti=', jti);

      if (!pending) {
        console.log('⚠️ [verify] pending not found / expired for', jti);
        return res.status(400).json({ message: 'Invalid or expired verification request.' });
      }
      if (pending.expiresAt && pending.expiresAt <= new Date()) {
        console.log('⚠️ [verify] pending expired at', pending.expiresAt);
        return res.status(400).json({ message: 'Verification link has expired.' });
      }

      const {
        name = '',
        email,
        phone = '',
        address = '',
        state = '',
        city = '',
        userType,                  // 'user' | 'vendor'
        businessTypes = [],
        passwordHash,
        password,
      } = pending;

      if (!email || !userType) {
        console.log('⚠️ [verify] invalid pending payload', { hasEmail: !!email, userType });
        return res.status(400).json({ message: 'Invalid pending registration data.' });
      }

      const normEmail = String(email).trim().toLowerCase();
      const role = String(userType).toLowerCase();

      // ensure not already created
      const exists = role === 'vendor'
        ? await Vendor.findOne({ email: normEmail }).select('_id')
        : await User.findOne({ email: normEmail }).select('_id');

      if (exists) {
        await PendingRegistration.deleteOne({ _id: jti });
        console.log('ℹ️ [verify] already verified earlier, cleaned pending, role=', role);
        return res.status(409).json({ message: 'Account already verified. Please log in.' });
      }

      // finalize password hash
      let finalHash = passwordHash || null;
      if (!finalHash) {
        if (!password) {
          console.log('⚠️ [verify] missing password/passwordHash for', normEmail);
          return res.status(400).json({ message: 'Missing password for account creation.' });
        }
        finalHash = await bcrypt.hash(String(password), 12);
      }

      let insertedId = null;

      if (role === 'vendor') {
        const vendorCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const ins = await Vendor.collection.insertOne({
          name: String(name).trim(),
          email: normEmail,
          phone: String(phone).trim(),
          address: String(address).trim(),
          state: String(state).trim(),
          city: String(city).trim(),
          password: finalHash, // already hashed
          vendorCode,
          businessTypes: (Array.isArray(businessTypes) ? businessTypes : []).map(t => ({
            serviceType: t,
            createdAt: new Date(),
          })),
          userType: 'vendor',
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        insertedId = ins.insertedId;
      } else {
        const userCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const affiliateLink = `${process.env.FRONTEND_BASE_URL}/?ref=${userCode}`;
        const ins = await User.collection.insertOne({
          name: String(name).trim(),
          email: normEmail,
          phone: String(phone).trim(),
          address: String(address).trim(),
          state: String(state).trim(),
          city: String(city).trim(),
          password: finalHash, // already hashed
          userCode,
          affiliateLink,
          isEmailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        insertedId = ins.insertedId;
      }

      await PendingRegistration.deleteOne({ _id: jti });
      console.log('✅ [verify] created', role, '->', insertedId?.toString?.());

      const appToken = signAppToken({ id: insertedId, email: normEmail, role });
      return res.json({ token: appToken, role });
    }

    // ── Legacy fallback (token carried full payload)
    const {
      name,
      email,
      password,
      phone = '',
      address = '',
      state = '',
      city = '',
      userType,
      businessTypes = [],
    } = decoded;

    if (!email || !password || !userType) {
      console.log('⚠️ [verify] legacy payload invalid');
      return res.status(400).json({ message: 'Invalid token payload.' });
    }

    const normEmail = String(email).trim().toLowerCase();
    const role = String(userType).toLowerCase();

    if (role === 'vendor') {
      const exists = await Vendor.findOne({ email: normEmail }).select('_id');
      if (exists) return res.status(409).json({ message: 'Account already verified. Please log in.' });

      const vendorCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const doc = await new Vendor({
        name,
        email: normEmail,
        password, // pre-save hook will hash
        phone,
        address,
        state,
        city,
        vendorCode,
        businessTypes: (businessTypes || []).map(t => ({ serviceType: t })),
        userType: 'vendor',
        isEmailVerified: true,
      }).save();

      const appToken = signAppToken({ id: doc._id, email: normEmail, role: 'vendor' });
      return res.json({ token: appToken, role: 'vendor' });
    } else {
      const exists = await User.findOne({ email: normEmail }).select('_id');
      if (exists) return res.status(409).json({ message: 'Account already verified. Please log in.' });

      const userCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const affiliateLink = `${process.env.FRONTEND_BASE_URL}/?ref=${userCode}`;
      const doc = await new User({
        name,
        email: normEmail,
        password, // pre-save hook will hash
        phone,
        address,
        state,
        city,
        userCode,
        affiliateLink,
        isEmailVerified: true,
      }).save();

      const appToken = signAppToken({ id: doc._id, email: normEmail, role: 'user' });
      return res.json({ token: appToken, role: 'user' });
    }
  } catch (err) {
    // This will ALWAYS print something useful if a 400 happens
    console.error('🛑 [verify] error:', {
      name: err?.name,
      message: err?.message,
      stack: err?.stack,
    });
    return res.status(400).json({
      message: 'Verification failed. Token may be expired or invalid.',
    });
  }
});

module.exports = router;

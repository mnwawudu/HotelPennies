// ✅ /routes/emailConfirm.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const Vendor = require('../models/vendorModel');
const { generateCode } = require('../utils/codeGenerator');

router.get('/verify-email/:token', async (req, res) => {
  const token = req.params.token;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { name, email, password, phone, address, userType, businessTypes } = decoded;

    // Check if already exists
    const exists = await (userType === 'user'
      ? User.findOne({ email })
      : Vendor.findOne({ email }));

    if (exists) {
      return res.redirect(`${process.env.FRONTEND_BASE_URL}/?verified=exists`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let savedUser, jwtToken;

    if (userType === 'vendor') {
      const vendorCode = generateCode();
      const newVendor = new Vendor({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        userType,
        businessTypes,
        vendorCode,
        isVerifiedTypes: [],
        isFullyVerified: false,
        isEmailVerified: true
      });
      savedUser = await newVendor.save();
      jwtToken = jwt.sign({ vendorId: savedUser._id, role: 'vendor' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    } else {
      const userCode = generateCode();
      const affiliateLink = `${process.env.FRONTEND_BASE_URL}/ref/${userCode}`;
      const newUser = new User({
        name,
        email,
        password: hashedPassword,
        phone,
        address,
        userCode,
        affiliateLink,
        isEmailVerified: true
      });
      savedUser = await newUser.save();
      jwtToken = jwt.sign({ userId: savedUser._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    }

    // Redirect to frontend with token in query
    return res.redirect(`${process.env.FRONTEND_BASE_URL}/email-verified?token=${jwtToken}&role=${userType}`);
  } catch (err) {
    console.error('Verification error:', err);
    return res.status(400).send('Verification failed. Token is invalid or expired.');
  }
});

module.exports = router;

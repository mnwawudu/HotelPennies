const express = require('express');
const router = express.Router();
const axios = require('axios');
const ChopsBooking = require('../models/chopsBookingModel');
const Chop = require('../models/chopModel');
const PickupDeliveryOption = require('../models/pickupDeliveryModel');

// 🧾 Ledger: 100% to platform helper
const { recordPlatformOnlyRevenue } = require('../services/ledgerService');

// 📧 ADDED — booking confirmation email helper
const sendBookingEmails = require('../utils/sendBookingEmails');

// 🔁 Inline helper to normalize state names
const normalizeState = (input) => {
  const map = {
    'imo': 'imo',
    'imo state': 'imo',
    'lagos': 'lagos',
    'lagos state': 'lagos',
    'abuja': 'fct',
    'fct': 'fct',
    'abuja fct': 'fct',
    'abia': 'abia',
    'abia state': 'abia',
    'enugu': 'enugu',
    'enugu state': 'enugu',
    'rivers': 'rivers',
    'rivers state': 'rivers',
    'kaduna': 'kaduna',
    'kaduna state': 'kaduna'
    // Add more if needed
  };

  return map[String(input || '').trim().toLowerCase()] || String(input || '').trim().toLowerCase();
};

// ✅ Helper function to extract state from address
const extractState = (address = '') => {
  const knownStates = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
    "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
    "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa", "Kaduna",
    "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
    "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo",
    "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
    "Abuja"
  ];

  const match = knownStates.find(state =>
    address.toLowerCase().includes(state.toLowerCase())
  );
  return match || null;
};

// ✅ POST /api/chops/bookings — WITH VERIFICATION
router.post('/bookings', async (req, res) => {
  try {
    const {
      chopId,
      fullName,
      phone,
      address,
      quantity,
      total,
      email,
      paymentReference,
      paymentProvider,
    } = req.body;

    // 1) Confirm Chop exists
    const chop = await Chop.findById(chopId);
    if (!chop) return res.status(404).json({ message: 'Chop not found' });

    // 2) Extract State from address
    const userState = extractState(address);
    if (!userState) {
      return res.status(400).json({ message: 'Could not determine delivery state from address' });
    }

    // 3) Check if Chops is available in that state
    const stateOption = await PickupDeliveryOption.findOne({
      businessType: 'chops',
      state: userState,
      isActive: true,
    });

    if (!stateOption) {
      return res.status(403).json({
        message: `We're sorry, Chops delivery is not available in ${userState}.`,
      });
    }

    // 4) Verify Payment
    let verified = false;

    if (paymentProvider === 'paystack') {
      const response = await axios.get(`https://api.paystack.co/transaction/verify/${paymentReference}`, {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
      });
      verified = response.data?.data?.status === 'success';
    }

    if (paymentProvider === 'flutterwave') {
      const response = await axios.get(
        `https://api/flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${paymentReference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      verified = response.data?.status === 'success';
    }

    if (!verified) {
      return res.status(402).json({ message: 'Payment verification failed' });
    }

    // 5) Save Booking After Successful Verification
    const booking = new ChopsBooking({
      chop: chopId,
      fullName,
      phone,
      address,
      quantity,
      total,
      email,
      paymentReference,
      paymentProvider,
      createdAt: new Date(),
    });

    await booking.save();

    // 6) 🧾 Ledger: 100% to platform (no vendor)
    //    We mark platform revenue as AVAILABLE immediately after successful payment.
    try {
      await recordPlatformOnlyRevenue({
        amount: Number(total),
        sourceType: 'order',       // aligns with ledger model enum
        sourceId: null,            // we don't have a generic Order; keep null
        currency: 'NGN',
        meta: {
          category: 'chops',
          bookingModel: 'ChopsBooking',
          bookingId: String(booking._id),
          chopId: String(chopId),
          email,
        },
      });
      console.log('🧾 Ledger platform-only revenue recorded for Chops:', String(booking._id));
    } catch (e) {
      console.error('⚠️ recordPlatformOnlyRevenue failed (booking saved):', e.message);
    }

    // 📧 ADDED — send booking confirmation (user + optional admin BCC)
    try {
      await sendBookingEmails({
        category: 'chops',
        title: chop?.name || 'Chops Order',
        userEmail: email,
        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL,
        fullName,
        phone,
        amount: total,
        paymentReference,
        // extra context (safe to ignore if util doesn’t use them)
        quantity,
        address
      });
    } catch (e) {
      console.warn('⚠️ sendBookingEmails(chops):', e?.message || e);
    }

    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (err) {
    console.error('❌ Booking creation failed:', err);
    res.status(500).json({ message: 'Booking failed' });
  }
});

// ✅ GET all bookings (admin use)
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await ChopsBooking.find()
      .populate('chop', 'name mainImage')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('❌ Failed to fetch bookings:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

module.exports = router;


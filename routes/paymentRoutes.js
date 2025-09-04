const express = require('express');
const axios = require('axios');
const Advert = require('../models/advertModel');
require('dotenv').config();

const router = express.Router();

/* ---------------------------
   Config flags / helpers
---------------------------- */
const HAS_PAYSTACK = !!process.env.PAYSTACK_SECRET_KEY;
const HAS_FLW_KEY  = !!process.env.FLUTTERWAVE_SECRET_KEY;
const FLW_ENABLED  = String(process.env.ENABLE_FLW_PAYMENTS || '0') === '1' && HAS_FLW_KEY;

// consistent error payload
function sendErr(res, err, fallback = 'Server error') {
  const payload = err?.response?.data || { message: err?.message || fallback };
  return res.status(500).json({ error: payload });
}

/* ----------------------------------
   PAYSTACK — INITIALIZE & VERIFY
----------------------------------- */

// Initialize Paystack payment
router.post('/paystack/initiate', async (req, res) => {
  if (!HAS_PAYSTACK) return res.status(501).json({ message: 'Paystack is not configured' });

  const { email, amount, advertId } = req.body;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: Math.round(Number(amount || 0) * 100), // kobo
        // optional: metadata, callback_url, etc
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    // Save Paystack reference to the advert
    const advert = await Advert.findById(advertId);
    if (!advert) return res.status(404).json({ message: 'Advert not found' });
    advert.paymentReference = response.data?.data?.reference;
    await advert.save();

    res.json(response.data);
  } catch (error) {
    return sendErr(res, error, 'Failed to initialize Paystack payment');
  }
});

// Verify Paystack payment
router.get('/paystack/verify/:reference', async (req, res) => {
  if (!HAS_PAYSTACK) return res.status(501).json({ message: 'Paystack is not configured' });

  const { reference } = req.params;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        timeout: 15000,
      }
    );

    if (response.data?.data?.status === 'success') {
      const advert = await Advert.findOne({ paymentReference: reference });
      if (!advert) return res.status(404).json({ message: 'Linked advert not found' });

      // mark featured & set expiry
      advert.paidStatus = true;
      advert.featured = true;

      const now = new Date();
      switch (advert.subscriptionPeriod) {
        case 'weekly':      advert.expiryDate = new Date(now.setDate(now.getDate() + 7)); break;
        case 'monthly':     advert.expiryDate = new Date(now.setMonth(now.getMonth() + 1)); break;
        case 'bi-annual':   advert.expiryDate = new Date(now.setMonth(now.getMonth() + 6)); break;
        case 'annual':      advert.expiryDate = new Date(now.setFullYear(now.getFullYear() + 1)); break;
        default:            advert.expiryDate = new Date(now.setMonth(now.getMonth() + 1));
      }

      await advert.save();
      return res.json({ message: 'Payment verified and advert marked as featured', advert });
    }

    return res.status(400).json({ message: 'Payment failed' });
  } catch (error) {
    return sendErr(res, error, 'Failed to verify Paystack payment');
  }
});

/* ----------------------------------
   FLUTTERWAVE — INIT & VERIFY (GATED)
   (Disabled unless ENABLE_FLW_PAYMENTS=1)
----------------------------------- */

router.post('/flutterwave/initiate', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(501).json({ message: 'Flutterwave payments are disabled' });
  }

  const { email, amount, name, advertId, currency = 'NGN' } = req.body;
  const tx_ref = `HP-${Date.now()}`;

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref,
        amount,
        currency,
        // TODO: update to your real redirect URL
        redirect_url: 'https://yourdomain.com/payment-success',
        customer: { email, name },
        customizations: {
          title: 'HotelPennies Payment',
          description: 'Booking payment',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const advert = await Advert.findById(advertId);
    if (!advert) return res.status(404).json({ message: 'Advert not found' });
    advert.paymentReference = tx_ref;
    await advert.save();

    res.json(response.data);
  } catch (error) {
    return sendErr(res, error, 'Failed to initialize Flutterwave payment');
  }
});

// NOTE: FLW verify by reference uses verify_by_reference
router.get('/flutterwave/verify/:tx_ref', async (req, res) => {
  if (!FLW_ENABLED) {
    return res.status(501).json({ message: 'Flutterwave payments are disabled' });
  }

  const { tx_ref } = req.params;

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(tx_ref)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
        timeout: 15000,
      }
    );

    if (response.data?.data?.status === 'successful') {
      const advert = await Advert.findOne({ paymentReference: tx_ref });
      if (!advert) return res.status(404).json({ message: 'Linked advert not found' });

      advert.paidStatus = true;
      advert.featured = true;

      const now = new Date();
      switch (advert.subscriptionPeriod) {
        case 'weekly':      advert.expiryDate = new Date(now.setDate(now.getDate() + 7)); break;
        case 'monthly':     advert.expiryDate = new Date(now.setMonth(now.getMonth() + 1)); break;
        case 'bi-annual':   advert.expiryDate = new Date(now.setMonth(now.getMonth() + 6)); break;
        case 'annual':      advert.expiryDate = new Date(now.setFullYear(now.getFullYear() + 1)); break;
        default:            advert.expiryDate = new Date(now.setMonth(now.getMonth() + 1));
      }

      await advert.save();
      return res.json({ message: 'Payment verified and advert marked as featured', advert });
    }

    return res.status(400).json({ message: 'Payment failed' });
  } catch (error) {
    return sendErr(res, error, 'Failed to verify Flutterwave payment');
  }
});

module.exports = router;

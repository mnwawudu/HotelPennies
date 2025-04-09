const express = require('express');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Initialize Paystack payment
router.post('/paystack/initiate', async (req, res) => {
  const { email, amount } = req.body;

  try {
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Convert to kobo
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response.data });
  }
});

// Verify Paystack payment
router.get('/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;

  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response.data });
  }
});

// Initialize Flutterwave payment
router.post('/flutterwave/initiate', async (req, res) => {
  const { email, amount, name, currency = 'NGN' } = req.body;

  const tx_ref = `HP-${Date.now()}`;

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref,
        amount,
        currency,
        redirect_url: 'https://yourdomain.com/payment-success',
        customer: {
          email,
          name,
        },
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
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response.data });
  }
});

// Verify Flutterwave payment
router.get('/flutterwave/verify/:tx_ref', async (req, res) => {
  const { tx_ref } = req.params;

  try {
    const response = await axios.get(
      `https://api.flutterwave.com/v3/transactions/${tx_ref}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response.data });
  }
});

module.exports = router;

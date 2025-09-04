// utils/flutterwaveConfig.js
const axios = require('axios');

const FLW_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

const createFlutterwavePaymentLink = async (data) => {
  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: `txn-${Date.now()}`,
        amount: data.amount,
        currency: 'NGN',
        redirect_url: data.redirect_url,
        customer: {
          email: data.email,
          name: data.name,
        },
        customizations: {
          title: 'Feature Listing Payment',
          description: data.description || 'Payment for Hotel/Room Feature Listing',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Error creating Flutterwave payment link:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { createFlutterwavePaymentLink };

// services/payments/paystack.js
const axios = require('axios');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

function hdrs() {
  return { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' };
}

async function ensureRecipient({ accountName, accountNumber, bankCode }) {
  const r = await axios.post('https://api.paystack.co/transferrecipient', {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN'
  }, { headers: hdrs() });
  return r?.data?.data?.recipient_code;
}

async function initiateTransfer({ amountNaira, recipientCode, reference, reason }) {
  const r = await axios.post('https://api.paystack.co/transfer', {
    source: 'balance',
    amount: Math.round(amountNaira) * 100,
    recipient: recipientCode,
    reason,
    reference, // idempotency key for our purposes
  }, { headers: hdrs() });
  const data = r?.data?.data || {};
  return { reference: data.reference || data.transfer_code || reference };
}

module.exports = { ensureRecipient, initiateTransfer };

// routes/paystackRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const auth = require('../middleware/auth');
const Vendor = require('../models/vendorModel');

// âœ… NEW: booking + ledger (non-breaking additions)
const Booking = require('../models/bookingModel');
const { ensureBookingLedger } = require('../services/ledgerService');

// ------------------ helpers ------------------

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

// Normalize names for comparison (strip spaces, punctuation, common suffixes)
const normalizeName = (s = '') => {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(nig|nigeria|intl|international|ventures|ltd|limited|plc|inc|llc|co|company|and|&)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

// fuzzy-ish check: allow â€œzimbooz ltdâ€ to match â€œzimboozâ€
const approxNameMatch = (a, b) => {
  const A = normalizeName(a);
  const B = normalizeName(b);
  if (!A || !B) return false;
  return A.includes(B) || B.includes(A);
};

// Resolve bank code from Paystack when missing
async function resolveBankCode(bankName) {
  try {
    const { data } = await axios.get('https://api.paystack.co/bank?currency=NGN', {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    });
    const banks = Array.isArray(data?.data) ? data.data : [];
    const target = normalizeName(bankName);
    const found = banks.find(
      (b) => normalizeName(b.name) === target || normalizeName(b.name).includes(target)
    );
    return found?.code || null;
  } catch (e) {
    console.warn('âš ï¸ resolveBankCode failed:', e?.response?.data || e.message);
    return null;
  }
}

// Ensure transfer recipient; returns {recipient_code}
async function ensureRecipient({ accountName, accountNumber, bankCode }) {
  // Paystack will dedupe identical account/name/bank combos
  const payload = {
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  };
  const { data } = await axios.post('https://api.paystack.co/transferrecipient', payload, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });
  if (!data?.status) {
    throw new Error('Failed to create transfer recipient');
  }
  return data.data; // { recipient_code, ... }
}

// Initiate transfer; possibly finalize with OTP in test mode if PAYSTACK_TRANSFER_OTP set
async function initiateTransfer({ amountNaira, recipient_code, reason = 'Vendor withdrawal' }) {
  // init
  const initPayload = {
    source: 'balance',
    amount: Math.round(Number(amountNaira) * 100), // Kobo
    recipient: recipient_code,
    reason,
  };
  const initRes = await axios.post('https://api.paystack.co/transfer', initPayload, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  });

  const init = initRes.data;
  if (!init?.status) {
    throw new Error('Failed to initiate transfer');
  }

  // In test mode, transfers may require OTP
  const needsOtp = init?.data?.status === 'otp';
  if (needsOtp && process.env.PAYSTACK_TRANSFER_OTP) {
    const transfer_code = init?.data?.transfer_code;
    const finPayload = {
      transfer_code,
      otp: process.env.PAYSTACK_TRANSFER_OTP,
    };
    const finRes = await axios.post(
      'https://api.paystack.co/transfer/finalize_transfer',
      finPayload,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } }
    );
    const fin = finRes.data;
    if (!fin?.status) {
      throw new Error('Failed to finalize transfer with OTP');
    }
    return { initiated: init?.data, finalized: fin?.data || null };
  }

  return { initiated: init?.data, finalized: null };
}

// Convert vendor pending payout lines to paid up to `amount` (FIFO; supports partial)
function consumePendingPayouts(vendorDoc, amountToPay) {
  if (!Array.isArray(vendorDoc.payoutHistory)) vendorDoc.payoutHistory = [];

  // Get indexes of pending entries by date (oldest first)
  const pending = vendorDoc.payoutHistory
    .map((p, idx) => ({ idx, p }))
    .filter(({ p }) => String(p.status).toLowerCase() === 'pending')
    .sort((a, b) => new Date(a.p.date || 0) - new Date(b.p.date || 0));

  let remaining = Math.round(Number(amountToPay) || 0);
  for (const { idx } of pending) {
    if (remaining <= 0) break;
    const entry = vendorDoc.payoutHistory[idx];
    const lineAmt = Math.round(Number(entry.amount) || 0);

    if (lineAmt <= remaining) {
      // full convert
      entry.status = 'paid';
      remaining -= lineAmt;
    } else {
      // split: reduce pending, insert a paid copy
      const paidPortion = remaining;
      entry.amount = lineAmt - paidPortion; // remaining pending
      vendorDoc.payoutHistory.splice(idx, 0, {
        ...entry,
        amount: paidPortion,
        status: 'paid',
        date: new Date(),
      });
      remaining = 0;
    }
  }

  return remaining === 0; // true if fully consumed
}

// ------------------ routes ------------------

// Keep your existing verify route; add optional ledger creation (idempotent)
router.get('/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  try {
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, // store securely
        },
      }
    );

    const data = response.data;
    if (data.status && data.data.status === 'success') {
      // âœ… OPTIONAL: attach to a booking and write ledger rows (non-breaking)
      // Pass bookingId as query param when calling this endpoint:
      //   GET /api/paystack/verify/<reference>?bookingId=<bookingId>
      const bookingId = req.query.bookingId;
      if (bookingId) {
        try {
          const booking = await Booking.findById(bookingId);
          if (booking) {
            // mark booking as paid if not already
            if (booking.paymentStatus !== 'paid') {
              booking.paymentStatus = 'paid';
              booking.provider = 'paystack';
              booking.paymentRef = reference;
              await booking.save();
            }
            // write ledger rows exactly once
            await ensureBookingLedger(booking);
          } else {
            console.warn('âš ï¸ verify: booking not found for bookingId', bookingId);
          }
        } catch (e) {
          console.error('âš ï¸ verify: ledger attach failed', e?.response?.data || e.message || e);
          // do not change response; verification has succeeded
        }
      }

      return res.json({ verified: true });
    } else {
      return res.json({ verified: false });
    }
  } catch (error) {
    console.error('âŒ Paystack verification error:', error.response?.data || error.message);
    res.status(500).json({ verified: false });
  }
});

// NEW: Vendor withdraw endpoint (kept intact; no behavior change)
router.post('/vendor-withdraw', auth, async (req, res) => {
  try {
    const vendorId = req.user?._id;
    if (!vendorId) return res.status(401).json({ message: 'Unauthorized' });

    const { amount, account } = req.body || {};
    const amountNaira = Math.round(Number(amount) || 0);
    if (!amountNaira || amountNaira < 5000) {
      return res.status(400).json({ message: 'Minimum withdrawal is â‚¦5,000' });
    }

    const vendor = await Vendor.findById(vendorId).exec();
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // compute pending balance
    const pendingBalance = (Array.isArray(vendor.payoutHistory) ? vendor.payoutHistory : [])
      .filter((p) => String(p.status).toLowerCase() === 'pending')
      .reduce((s, p) => s + Number(p.amount || 0), 0);

    if (amountNaira > pendingBalance) {
      return res.status(400).json({ message: 'Amount exceeds pending balance' });
    }

    // Require a saved payout account and match against provided one
    const savedAccounts = Array.isArray(vendor.payoutAccounts) ? vendor.payoutAccounts : [];
    const match = savedAccounts.find(
      (a) =>
        String(a.accountNumber) === String(account?.accountNumber) &&
        normalizeName(a.bankName) === normalizeName(account?.bankName)
    );
    if (!match) {
      return res.status(400).json({ message: 'Selected account is not on file for this vendor' });
    }

    // Enforce account name â‰ˆ vendor name
    const registeredName = vendor.name || '';
    const acctName = account?.accountName || match.accountName || '';
    if (!approxNameMatch(registeredName, acctName)) {
      return res.status(400).json({
        message: `Account name must match business name on file (${registeredName}).`,
      });
    }

    // Ensure bankCode
    let bankCode = account?.bankCode || match.bankCode || null;
    if (!bankCode) {
      bankCode = await resolveBankCode(account?.bankName || match.bankName);
      if (!bankCode) return res.status(400).json({ message: 'Could not resolve bank code for bank name' });
    }

    // Create transfer recipient
    const recipient = await ensureRecipient({
      accountName: acctName,
      accountNumber: account?.accountNumber || match.accountNumber,
      bankCode,
    });

    // Initiate transfer (and auto-finalize if OTP env provided)
    const tx = await initiateTransfer({
      amountNaira,
      recipient_code: recipient.recipient_code,
      reason: `Vendor withdrawal for ${registeredName}`,
    });

    // Convert pending entries to paid up to amount
    const ok = consumePendingPayouts(vendor, amountNaira);
    if (!ok) {
      // this should not happen because we checked pendingBalance first
      console.warn('âš ï¸ consumePendingPayouts ended with remainder.');
    }

    // Add an audit entry (optional; does not affect totals since we already converted lines)
    vendor.payoutHistory.push({
      amount: amountNaira,
      account: {
        bankName: account?.bankName || match.bankName,
        accountNumber: account?.accountNumber || match.accountNumber,
        accountName: acctName,
        bankCode,
      },
      status: 'paid',
      date: new Date(),
      // attach paystack meta fields without changing schema
      transferMeta: {
        recipient_code: recipient.recipient_code,
        initiated: tx.initiated || null,
        finalized: tx.finalized || null,
      },
    });

    await vendor.save();

    return res.json({
      message: 'Withdrawal processed',
      amount: amountNaira,
      recipient: recipient.recipient_code,
      status: tx.finalized ? 'paid' : 'processing',
    });
  } catch (err) {
    console.error('âŒ vendor-withdraw error:', err?.response?.data || err.message || err);
    return res.status(500).json({ message: 'Withdrawal failed' });
  }
});

module.exports = router;


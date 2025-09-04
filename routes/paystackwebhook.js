// routes/paystackWebhook.js
const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');

const Payout = require('../models/payoutModel');
const Ledger = require('../models/ledgerModel');

const router = express.Router();

const isTestKey = () => /^sk_test_/i.test(String(process.env.PAYSTACK_SECRET_KEY || ''));
const expectedDomain = () => (isTestKey() ? 'test' : 'live');

/** HMAC validation against RAW body (sha512 with PAYSTACK_SECRET_KEY) */
function isValidSignature(rawBody, headerSig, secret) {
  if (!rawBody || !headerSig || !secret) return false;
  const expectedHex = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expectedHex, 'utf8');
  const b = Buffer.from(String(headerSig).trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Dedup key for webhook payloads */
function digestFor(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

/** one-time reversal (uses transaction + unique index suggestion in schema note) */
async function reverseHoldOnce(session, payout, note = 'reverse_lock') {
  // Create unique reversal row; if it already exists, this will no-op via unique index
  await Ledger.create([{
    accountType: payout.payeeType,
    accountModel: payout.payeeType === 'user' ? 'User' : 'Vendor',
    accountId:   payout.vendorId || payout.userId,
    sourceType:  'payout',
    sourceModel: 'Payout',
    sourceId:    payout._id,
    direction:   'credit',
    amount:      Number(payout.amount || 0),   // amount stored in KOBO
    currency:    payout.currency || 'NGN',
    status:      'available',
    releaseOn:   null,
    reason:      'adjustment',
    meta:        { payoutId: payout._id, note, event: 'webhook' },
  }], { session });
}

router.post('/', async (req, res) => {
  try {
    const sig = req.headers['x-paystack-signature'];
    if (!isValidSignature(req.body, sig, process.env.PAYSTACK_SECRET_KEY)) {
      return res.sendStatus(401);
    }

    // parse AFTER verifying sig
    const evt = JSON.parse(req.body.toString('utf8'));
    const { event, data = {} } = evt;

    // Mode mismatch guard (test vs live)
    if (data.domain && data.domain !== expectedDomain()) {
      // acknowledge but ignore; prevents cross-mode pollution
      return res.sendStatus(200);
    }

    // Deduplicate identical retries (compute digest of raw body)
    const digest = digestFor(req.body);
    // Use payout meta to track last digests processed (lightweight) — best is a WebhookEvents collection, but this avoids new models.
    // We'll short-circuit if payout shows we've already processed this digest.
    const transferCode = data.transfer_code || data.transferCode || null;
    const reference    = data.reference || null;
    if (!transferCode && !reference) return res.sendStatus(200);

    const or = [];
    if (transferCode) or.push({ transferRef: transferCode });
    if (reference)    or.push({ reference });

    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      const payout = await Payout.findOne({ $or: or }).session(session);
      if (!payout) return; // unknown payout; ack

      // short-circuit dedup
      const processed = Array.isArray(payout.meta?.webhookDigests) ? payout.meta.webhookDigests : [];
      if (processed.includes(digest)) return;

      const ev = String(event || '').toLowerCase();
      const status = String(data.status || '').toLowerCase();

      if (ev === 'transfer.success' || (ev.startsWith('transfer') && status === 'success')) {
        if (payout.status !== 'paid') {
          payout.status = 'paid';
          payout.paidAt = new Date();
        }
      } else if (ev === 'transfer.failed' || ev === 'transfer.reversed' || status === 'failed') {
        if (!['failed','cancelled','rejected'].includes(payout.status)) {
          await reverseHoldOnce(session, payout, ev || status);
          payout.status = 'failed';
          payout.failedAt = new Date();
        }
      } else {
        // ignore unrelated events
      }

      // record digest (keep last 20)
      const arr = processed.concat(digest);
      payout.meta = Object.assign({}, payout.meta || {}, {
        webhookDigests: arr.slice(-20),
        paystackLast: { event, at: new Date(), transfer_code: transferCode, reference }
      });

      await payout.save({ session });
    });

    return res.sendStatus(200);
  } catch (err) {
    console.error('[paystackWebhook] error:', err);
    // ACK anyway (we’re idempotent), to avoid retries hammering you
    return res.sendStatus(200);
  }
});

module.exports = router;

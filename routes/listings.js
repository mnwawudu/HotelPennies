// routes/listings.js (example)
const express = require('express');
const { ensureVendorAuth } = require('../middleware/auth');
const Listing = require('../models/listingModel');
const { recordImpliedAcceptance } = require('./vendorAgreement'); // import helper

const router = express.Router();

router.post('/vendor/listings/:id/publish', ensureVendorAuth, async (req, res) => {
  // ...verify ownership of listing, validation, etc.

  // Non-blocking: record implied acceptance (no dates shown to vendor)
  recordImpliedAcceptance(req).catch(() => { /* avoid breaking publish on log failure */ });

  await Listing.updateOne(
    { _id: req.params.id, vendorId: req.user.id },
    { $set: { status: 'published', publishedAt: new Date() } }
  );

  res.json({ ok: true });
});

module.exports = router;

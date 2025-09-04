// utils/reverseVendorShare.js
const Ledger = require('../models/ledgerModel');

async function reverseVendorShare({ booking, category = 'hotel' }) {
  if (!booking?._id) return;

  // 1) Try to locate the vendor + amount from existing ledger credits
  const vendorCredits = await Ledger.find({
    bookingId: booking._id,
    accountType: 'vendor',
    direction: 'credit',
    reason: 'vendor_share',
  }).lean();

  if (vendorCredits.length) {
    // Sum by vendor and post a compensating debit(adjustment) once per vendor
    const byVendor = new Map();
    for (const c of vendorCredits) {
      const k = String(c.accountId);
      byVendor.set(k, (byVendor.get(k) || 0) + Number(c.amount || 0));
    }

    for (const [vendorId, total] of byVendor.entries()) {
      if (total > 0) {
        // Idempotency: if we already posted this reversal, skip
        const exists = await Ledger.findOne({
          accountType: 'vendor',
          accountId: vendorId,
          bookingId: booking._id,
          sourceType: 'adjustment',
          reason: 'adjustment',
          'meta.subtype': 'vendor_share_reversal',
        }).lean();

        if (!exists) {
          await Ledger.create({
            accountType: 'vendor',
            accountId: vendorId,
            sourceType: 'adjustment',
            direction: 'debit',
            amount: total,
            currency: 'NGN',
            status: 'available',
            reason: 'adjustment',
            bookingId: booking._id,
            meta: { subtype: 'vendor_share_reversal', category },
          });
        }
      }
    }

    // Mark original credits as reversed for UI visibility (doesn't affect sums)
    await Ledger.updateMany(
      { bookingId: booking._id, accountType: 'vendor', reason: 'vendor_share' },
      { $set: { 'meta.reversed': true } }
    );

    return; // done
  }

  // 2) Fallback: derive vendor + share from booking (for very old rows without ledger)
  let vendorId = null;
  let vendorShare = 0;

  try {
    if (category === 'hotel') {
      const Room = require('../models/roomModel');
      const room = await Room.findById(booking.room).select('vendorId').lean();
      vendorId = room?.vendorId || null;
    } else if (category === 'shortlet') {
      const Shortlet = require('../models/shortletModel');
      const s = await Shortlet.findById(booking.shortlet).select('vendorId').lean();
      vendorId = s?.vendorId || null;
    }
  } catch (_) { /* soft */ }

  // your split is 85% vendor (what you credit on booking)
  vendorShare = Math.round(Number(booking.price || 0) * 0.85);

  if (vendorId && vendorShare > 0) {
    const exists = await Ledger.findOne({
      accountType: 'vendor',
      accountId: vendorId,
      bookingId: booking._id,
      sourceType: 'adjustment',
      reason: 'adjustment',
      'meta.subtype': 'vendor_share_reversal',
    }).lean();

    if (!exists) {
      await Ledger.create({
        accountType: 'vendor',
        accountId: vendorId,
        sourceType: 'adjustment',
        direction: 'debit',
        amount: vendorShare,
        currency: 'NGN',
        status: 'available',
        reason: 'adjustment',
        bookingId: booking._id,
        meta: { subtype: 'vendor_share_reversal', category, fallback: true },
      });
    }
  }
}

module.exports = { reverseVendorShare };

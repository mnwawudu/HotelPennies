// ✅ routes/eventCenterBookingRoutes.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

const EventCenterBooking = require('../models/eventCenterBookingModel');
const EventCenter = require('../models/eventCenterModel');
const Vendor = require('../models/vendorModel');
const Ledger = require('../models/ledgerModel'); // for cancel reversal

// ✅ Ledger
const { recordBookingLedger, releasePendingForBooking } = require('../services/ledgerService');

// 📧 send booking confirmation (ADDED)
const sendBookingEmails = require('../utils/sendBookingEmails');

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// UTC-only date string
function formatDateOnly(date) {
  const d = new Date(date);
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

router.post('/', async (req, res) => {
  try {
    const {
      eventCenterId,
      fullName,
      email,
      phone,
      eventDate,
      guests,
      paymentRef,
      paymentMethod,
      amount,
    } = req.body;

    if (
      !eventCenterId || !fullName || !email || !phone ||
      !eventDate || !guests || !paymentRef || !paymentMethod || !amount
    ) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1) Validate event center
    const eventCenter = await EventCenter.findById(eventCenterId);
    if (!eventCenter) {
      return res.status(404).json({ error: 'Event center not found' });
    }

    // 2) Reject if vendor blocked the date
    const formattedEventDate = formatDateOnly(eventDate);
    const normalizedUnavailable = (eventCenter.unavailableDates || []).map((date) =>
      formatDateOnly(date)
    );
    if (normalizedUnavailable.includes(formattedEventDate)) {
      return res.status(400).json({ error: 'Selected date is unavailable. Please choose another date.' });
    }

    // 3) Verify payment (Paystack)
    const verifyUrl = `https://api.paystack.co/transaction/verify/${paymentRef}`;
    const verifyRes = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const { status, data } = verifyRes.data || {};
    if (!status || data?.status !== 'success') {
      return res.status(400).json({ error: 'Payment not verified or failed' });
    }

    // 4) Save booking (store vendorId)
    const newBooking = new EventCenterBooking({
      eventCenterId,
      vendorId: eventCenter.vendorId,
      fullName,
      email,
      phone,
      eventDate,
      guests,
      paymentRef,
      paymentMethod,
      amount,
      paymentStatus: 'paid',
    });
    await newBooking.save();

    // 📧 Send booking confirmation email (ADDED)
    try {
      let vendorEmail = null;
      try {
        if (eventCenter.vendorId) {
          const v = await Vendor.findById(eventCenter.vendorId).select('email').lean();
          vendorEmail = v?.email || null;
        }
      } catch { /* ignore vendor lookup errors for email */ }

      await sendBookingEmails({
        category: 'event', // explicit → "Event Center Booking Confirmed"
        title: eventCenter.name || eventCenter.title || 'Event Center',
        userEmail: email,
        vendorEmail,
        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL, // optional BCC if set
        fullName,
        phone,
        guests,
        amount,
        paymentReference: paymentRef,
        eventDate, // include itinerary date
      });
    } catch (e) {
      console.warn('⚠️ sendBookingEmails(event):', e?.message || e);
    }

    // 5) Vendor payout legacy (pending, 85%)
    try {
      const vendorId = eventCenter.vendorId;
      if (vendorId) {
        const vendor = await Vendor.findById(vendorId).exec();
        if (vendor) {
          const vendorShare = Math.round(Number(amount) * 0.85);
          vendor.payoutHistory = vendor.payoutHistory || [];
          vendor.payoutHistory.push({
            amount: vendorShare,
            account: {},
            status: 'pending',
            date: new Date(),
          });
          await vendor.save();
          console.log(`🏦 Vendor credited (pending) ${vendor.email} +${vendorShare}`);
        } else {
          console.warn('⚠️ Vendor not found for EventCenter.vendorId:', String(vendorId));
        }
      } else {
        console.warn('⚠️ No vendorId on EventCenter; vendor payout skipped.');
      }
    } catch (payoutErr) {
      console.warn('⚠️ Vendor payout failed:', payoutErr?.message || payoutErr);
    }

    // 6) ✅ Ledger (85/15, no cashback/commission)
    try {
      await recordBookingLedger(
        {
          _id: newBooking._id,
          vendorId: eventCenter.vendorId,
          userId: null,
          totalCost: Number(amount),
          checkInDate: eventDate ? new Date(eventDate) : null,
          checkOutDate: eventDate ? new Date(eventDate) : null,
          type: 'event_center', // <- important for correct categorization
        },
        { category: 'event_center' }
      );
      console.log('🧾 Ledger rows recorded for event center booking:', String(newBooking._id));
    } catch (e) {
      console.error('⚠️ recordBookingLedger failed (booking continues):', e.message);
    }

    return res.status(201).json({ message: 'Booking confirmed', booking: newBooking });
  } catch (err) {
    const error = err?.response?.data?.error || '❌ Failed to confirm booking. Please try again.';
    console.error('❌ Booking failed:', error);
    return res.status(500).json({ error });
  }
});

/* ---------- Optional service lifecycle endpoints ---------- */

// Mark check-in (soft)
router.post('/:id/check-in', async (req, res) => {
  const b = await EventCenterBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_in';
    b.checkInDate = b.checkInDate || new Date();
    await b.save();
  } catch (_) {}

  res.json({ ok: true });
});

// Mark check-out and release pending → available
router.post('/:id/check-out', async (req, res) => {
  const b = await EventCenterBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_out';
    b.checkOutDate = b.checkOutDate || new Date();
    await b.save();
  } catch (_) {}

  const released = await releasePendingForBooking(b._id);
  res.json({ ok: true, released });
});

// ❌ Cancel booking (reverse vendor share in ledger)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { email } = req.body;
    const booking = await EventCenterBooking.findById(req.params.id).populate('eventCenterId').exec();
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.canceled) return res.status(400).json({ error: 'Booking already canceled' });
    if (!email || String(booking.email || '').toLowerCase() !== String(email).toLowerCase()) {
      return res.status(403).json({ error: 'Email does not match booking owner' });
    }

    const now = new Date();
    const eventDate = new Date(booking.eventDate);
    if (eventDate <= now) {
      return res.status(400).json({ error: 'Cannot cancel on/after event date' });
    }

    // Reverse vendor share in ledger
    try {
      const vendorCredits = await Ledger.find({
        sourceType: 'booking',
        bookingId: booking._id,
        accountType: 'vendor',
        direction: 'credit',
        reason: 'vendor_share',
      }).lean();

      if (vendorCredits && vendorCredits.length) {
        const existing = await Ledger.exists({
          sourceType: 'booking',
          bookingId: booking._id,
          accountType: 'vendor',
          direction: 'debit',
          reason: 'adjustment',
          'meta.kind': 'vendor_share_reversal',
        });
        if (!existing) {
          const byVendor = new Map();
          for (const c of vendorCredits) {
            const key = String(c.accountId);
            byVendor.set(key, (byVendor.get(key) || 0) + Number(c.amount || 0));
          }
          const toCreate = [];
          for (const [vendorId, amt] of byVendor.entries()) {
            if (amt > 0) {
              toCreate.push({
                accountType: 'vendor',
                accountId: vendorId,
                sourceType: 'booking',
                sourceModel: 'Booking',
                sourceId: booking._id,
                bookingId: booking._id,
                direction: 'debit',
                amount: amt,
                reason: 'adjustment',
                status: 'pending',
                currency: 'NGN',
                meta: { category: 'event_center', kind: 'vendor_share_reversal' },
              });
            }
          }
          if (toCreate.length) await Ledger.insertMany(toCreate);
        }
      }
    } catch (e) {
      console.warn('⚠️ [eventcenter/cancel] Vendor reversal posting failed (soft):', e.message);
    }

    booking.canceled = true;
    booking.cancellationDate = now;
    await booking.save();

    return res.status(200).json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('❌ [eventcenter/cancel] Error:', err);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

module.exports = router;

// âœ… routes/restaurantBookingRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const RestaurantBooking = require('../models/restaurantBookingModel');
const Restaurant = require('../models/restaurantModel');
const Vendor = require('../models/vendorModel');
const Ledger = require('../models/ledgerModel');
const auth = require('../middleware/auth');

// ðŸ“§ ADDED: booking confirmation email
const sendBookingEmails = require('../utils/sendBookingEmails');

// âœ… Ledger
const { recordBookingLedger, releasePendingForBooking } = require('../services/ledgerService');

// Create a new restaurant booking (pre-verify path; no payouts here)
router.post('/', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      restaurantId,
      bookingType,
      guests,
      reservationTime,
      deliveryLocation,
      pickupOptionId,
      menuItems,
      totalPrice,
      paymentReference,
      paymentProvider,
      paymentStatus = 'pending',
      notes, // âœ… FIX: accept notes on pre-verify path too
    } = req.body;

    if (!fullName || !email || !phone || !restaurantId || !bookingType || !totalPrice) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

    if (bookingType === 'reserve') {
      if (!guests || !reservationTime) {
        return res.status(400).json({ message: 'Missing guests or reservationTime for reservation' });
      }
    }

    const newBooking = new RestaurantBooking({
      userId: req.user?._id,
      fullName,
      email,
      phone,
      restaurant: restaurantId,
      bookingType,
      guests,
      reservationTime,
      deliveryLocation,
      pickupOptionId,
      menuItems,
      totalPrice,
      paymentStatus,
      paymentReference,
      paymentProvider,
      notes, // âœ… FIX: persist notes if your schema supports it
    });

    await newBooking.save();
    res.status(201).json({ message: 'Booking created successfully', booking: newBooking });
  } catch (err) {
    console.error('[Booking creation error]:', err);
    res.status(500).json({ message: 'Server error', error: err.message || err.toString() });
  }
});

// Get bookings by user (authenticated)
router.get('/my', auth, async (req, res) => {
  try {
    const bookings = await RestaurantBooking.find({ email: req.user.email })
      .populate('restaurant')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) {
    console.error('[Fetch bookings error]:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// Cancel booking by ID (email check + ledger reversal of vendor share)
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { email } = req.body;
    const booking = await RestaurantBooking.findById(req.params.id).populate('restaurant');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    if (booking.email !== email) {
      return res.status(403).json({ message: 'Unauthorized cancellation' });
    }
    if (booking.canceled) {
      return res.status(400).json({ message: 'Already canceled' });
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
                meta: { category: 'restaurant', kind: 'vendor_share_reversal' },
              });
            }
          }
          if (toCreate.length) await Ledger.insertMany(toCreate);
        }
      }
    } catch (e) {
      console.warn('âš ï¸ [restaurant/cancel] Vendor reversal posting failed (soft):', e.message);
    }

    booking.canceled = true;
    booking.cancellationDate = new Date();
    await booking.save();

    res.json({ message: 'Booking canceled successfully' });
  } catch (err) {
    console.error('[Cancel booking error]:', err);
    res.status(500).json({ message: 'Failed to cancel booking' });
  }
});

// Update payment status (authenticated)
router.patch('/:id/payment-status', auth, async (req, res) => {
  try {
    const { paymentStatus, paymentReference, paymentProvider } = req.body;
    const booking = await RestaurantBooking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    booking.paymentStatus = paymentStatus;
    if (paymentReference) booking.paymentReference = paymentReference;
    if (paymentProvider) booking.paymentProvider = paymentProvider;

    await booking.save();
    res.json({ message: 'Payment updated', booking });
  } catch (err) {
    console.error('[Payment update error]:', err);
    res.status(500).json({ message: 'Failed to update payment' });
  }
});

// âœ… Save booking AFTER payment is verified (+ credit vendor 85% as PENDING)
router.post('/verified', async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      restaurantId,
      bookingType,
      guests,
      reservationTime,
      deliveryLocation,
      pickupOptionId,
      menuItems,
      totalPrice,
      paymentReference,
      paymentProvider,
      notes, // âœ… FIX: accept notes here as well
    } = req.body;

    if (
      !fullName || !email || !phone || !restaurantId ||
      !bookingType || !totalPrice || !paymentReference || !paymentProvider
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify payment
    if (paymentProvider === 'paystack') {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${paymentReference}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      const status = response.data?.data?.status;
      if (status !== 'success') {
        return res.status(400).json({ message: 'Payment verification failed (Paystack)' });
      }
    } else if (paymentProvider === 'flutterwave') {
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?reference=${paymentReference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      const status = response.data?.data?.status;
      if (status !== 'successful') {
        return res.status(400).json({ message: 'Payment verification failed (Flutterwave)' });
      }
    }

    // Save booking
    const newBooking = new RestaurantBooking({
      fullName,
      email,
      phone,
      restaurant: restaurantId,
      bookingType,
      guests,
      reservationTime,
      deliveryLocation,
      pickupOptionId,
      menuItems,
      totalPrice,
      paymentStatus: 'paid',
      paymentReference,
      paymentProvider,
      notes, // âœ… FIX: persist notes post-verify too
    });
    await newBooking.save();

    // ðŸ“§ ADDED: Send booking confirmation email (user + BCC vendor/admin)
    try {
      let vendorEmail = null;
      let restName = 'Restaurant';
      try {
        const rest = await Restaurant.findById(restaurantId).select('vendorId name').lean();
        restName = rest?.name || restName;
        if (rest?.vendorId) {
          const v = await Vendor.findById(rest.vendorId).select('email').lean();
          vendorEmail = v?.email || null;
        }
      } catch { /* ignore vendor lookup errors for email */ }

      await sendBookingEmails({
        // âœ… FIX: be compatible with either signature of the helper
        to: email,                // some versions expect "to"
        userEmail: email,         // some expect "userEmail"
        bcc: vendorEmail || undefined,
        vendorEmail: vendorEmail || undefined,

        category: 'restaurant',
        title: restName,
        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL, // optional BCC if set
        fullName,
        phone,
        guests,
        amount: totalPrice,
        reservationTime, // util will include when supported
        paymentReference,
        notes,           // âœ… FIX: include notes in the email body
      });
    } catch (e) {
      console.warn('âš ï¸ sendBookingEmails(restaurant):', e?.message || e);
    }

    // ðŸ¦ Credit Vendor 85% as PENDING (legacy)
    try {
      const restaurant = await Restaurant.findById(restaurantId).select('vendorId name').exec();
      const vendorId = restaurant?.vendorId;
      if (!vendorId) {
        console.warn('âš ï¸ No vendorId on Restaurant; vendor payout skipped.');
      } else {
        const vendor = await Vendor.findById(vendorId).exec();
        if (!vendor) {
          console.warn('âš ï¸ Vendor not found for Restaurant.vendorId:', String(vendorId));
        } else {
          const vendorShare = Math.round(Number(totalPrice) * 0.85);
          vendor.payoutHistory = vendor.payoutHistory || [];
          vendor.payoutHistory.push({
            amount: vendorShare,
            account: {},
            status: 'pending',
            date: new Date(),
          });
          await vendor.save();
          console.log(`ðŸ¦ Vendor credited (pending) ${vendor.email} +${vendorShare}`);
        }
      }
    } catch (payoutErr) {
      console.warn('âš ï¸ Vendor payout failed:', payoutErr?.message || payoutErr);
    }

    // ðŸ§¾ Ledger (85/15, no cashback/commission)
    try {
      const restForLedger = await Restaurant.findById(restaurantId).select('vendorId').lean();
      if (restForLedger?.vendorId) {
        await recordBookingLedger(
          {
            _id: newBooking._id,
            vendorId: restForLedger.vendorId,
            userId: newBooking.userId || null,
            totalCost: Number(totalPrice),
            checkInDate: reservationTime ? new Date(reservationTime) : null,
            checkOutDate: reservationTime ? new Date(reservationTime) : null,
            type: 'restaurant',
          },
          { category: 'restaurant' }
        );
        console.log('ðŸ§¾ Ledger rows recorded for restaurant booking:', String(newBooking._id));
      } else {
        console.warn('âš ï¸ No vendorId found for restaurant; ledger skipped.');
      }
    } catch (e) {
      console.error('âš ï¸ recordBookingLedger failed (booking continues):', e.message);
    }

    res.status(201).json({ message: 'Booking saved after payment verification', booking: newBooking });
  } catch (err) {
    console.error('[Verified booking error]:', err);
    res.status(500).json({ message: 'Server error during payment verification' });
  }
});

// Mark check-in (soft)
router.post('/:id/check-in', auth, async (req, res) => {
  const b = await RestaurantBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_in';
    b.checkInDate = b.checkInDate || new Date();
    await b.save();
  } catch (_) {}

  res.json({ ok: true });
});

// Mark check-out and release pending â†’ available
router.post('/:id/check-out', auth, async (req, res) => {
  const b = await RestaurantBooking.findById(req.params.id);
  if (!b) return res.status(404).json({ message: 'Booking not found' });

  try {
    b.serviceStatus = 'checked_out';
    b.checkOutDate = b.checkOutDate || new Date();
    await b.save();
  } catch (_) {}

  const released = await releasePendingForBooking(b._id);
  res.json({ ok: true, released });
});

module.exports = router;


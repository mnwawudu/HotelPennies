const express = require('express');
const router = express.Router();
const axios = require('axios');

const Gift = require('../models/giftModel');
const GiftBooking = require('../models/giftBookingModel'); // ✅ use dedicated model
const upload = require('../middleware/upload');
const adminAuth = require('../middleware/adminAuth');

// 📧 ADDED — booking confirmation email helper
const sendBookingEmails = require('../utils/sendBookingEmails');
// 📧 ADDED — to BCC the vendor when possible
const Vendor = require('../models/vendorModel');

// 🔁 Inline helper to normalize state names
const normalizeState = (input = '') => {
  const map = {
    'imo': 'imo',
    'imo state': 'imo',
    'lagos': 'lagos',
    'lagos state': 'lagos',
    'abuja': 'fct',
    'fct': 'fct',
    'abuja fct': 'fct',
    'abia': 'abia',
    'abia state': 'abia',
    'enugu': 'enugu',
    'enugu state': 'enugu',
    'rivers': 'rivers',
    'rivers state': 'rivers',
    'kaduna': 'kaduna',
    'kaduna state': 'kaduna'
  };
  return map[input.trim().toLowerCase()] || input.trim().toLowerCase();
};

// =================== PUBLIC ===================
router.get('/public', async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page  || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '12', 10), 1), 50);
    const skip  = (page - 1) * limit;

    const gifts = await Gift.find({})
      .sort({
        averageRating: -1,  // ⭐ highest rated first
        bookingsCount: -1,  // 🧾 most booked next
        ctr: -1,            // 👀 highest CTR next
        createdAt: -1,      // ⏱️ newest as tiebreaker
      })
      .select('name mainImage images price promoPrice hasDelivery promo averageRating bookingsCount ctr createdAt')
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(gifts);
  } catch (err) {
    console.error('❌ Failed to fetch public gifts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Public GET single gift (for reviews)
router.get('/public/:id', async (req, res) => {
  try {
    const gift = await Gift.findById(req.params.id);
    if (!gift) return res.status(404).json({ message: 'Gift not found' });
    res.json(gift);
  } catch (err) {
    console.error('❌ Error fetching gift:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// =================== ADMIN ===================

router.get('/', adminAuth, async (req, res) => {
  try {
    const gifts = await Gift.find();
    res.json(gifts);
  } catch (err) {
    console.error('❌ Failed to fetch admin gifts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const gift = new Gift(req.body);
    await gift.save();
    res.status(201).json(gift);
  } catch (err) {
    console.error('❌ Failed to create gift:', err);
    res.status(400).json({ message: 'Failed to create gift' });
  }
});

router.post('/upload/:id', adminAuth, upload.array('images'), async (req, res) => {
  try {
    const gift = await Gift.findById(req.params.id);
    if (!gift) return res.status(404).json({ message: 'Gift not found' });

    const imageUrls = req.files.map(file => file.path);
    gift.images.push(...imageUrls);

    if (!gift.mainImage && imageUrls.length > 0) {
      gift.mainImage = imageUrls[0];
    }

    await gift.save();
    res.json({ message: 'Images uploaded', urls: imageUrls });
  } catch (err) {
    console.error('❌ Image upload failed:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

router.put('/:id/main-image', adminAuth, async (req, res) => {
  try {
    const { mainImage } = req.body;
    const gift = await Gift.findById(req.params.id);
    if (!gift) return res.status(404).json({ message: 'Gift not found' });

    gift.mainImage = mainImage;
    await gift.save();
    res.json({ message: 'Main image updated', mainImage });
  } catch (err) {
    console.error('❌ Failed to update main image:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const updated = await Gift.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: 'Gift not found' });
    res.json(updated);
  } catch (err) {
    console.error('❌ Failed to update gift:', err);
    res.status(500).json({ message: 'Failed to update gift' });
  }
});

router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const gift = await Gift.findByIdAndDelete(req.params.id);
    if (!gift) return res.status(404).json({ message: 'Gift not found' });
    res.status(200).json({ message: 'Gift deleted successfully' });
  } catch (err) {
    console.error('❌ Failed to delete gift:', err);
    res.status(500).json({ message: 'Failed to delete gift' });
  }
});

router.get('/:id/unavailable-dates', adminAuth, async (req, res) => {
  try {
    const item = await Gift.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ unavailableDates: item.unavailableDates || [] });
  } catch (err) {
    console.error('❌ Failed to get unavailable dates:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/unavailable-dates', adminAuth, async (req, res) => {
  try {
    const item = await Gift.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    item.unavailableDates = req.body.unavailableDates;
    await item.save();
    res.json({ message: 'Unavailable dates updated' });
  } catch (err) {
    console.error('❌ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Failed to update dates' });
  }
});

// =================== PAYMENT VERIFY ===================

router.post('/verify/paystack', async (req, res) => {
  const { reference } = req.body;
  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });

    if (response.data.status && response.data.data.status === 'success') {
      return res.json({ status: 'success', data: response.data.data });
    } else {
      return res.status(400).json({ status: 'failed', message: 'Verification failed' });
    }
  } catch (err) {
    console.error('❌ Verification error:', err.message);
    res.status(500).json({ error: 'Verification error' });
  }
});

// =================== BOOKINGS ===================
// Save Gift Booking AFTER payment verification (server-side)
router.post('/bookings/verified', async (req, res) => {
  const {
    giftId,
    fullName,
    email,
    phone,
    address = '',
    quantity,
    total,
    paymentReference,
    paymentProvider,
  } = req.body;

  try {
    // 0) Validate basics
    if (!giftId || !fullName || !phone || !quantity || !total || !paymentReference || !paymentProvider) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1) Confirm gift exists
    const gift = await Gift.findById(giftId);
    if (!gift) return res.status(404).json({ error: 'Gift not found' });

    // 2) Verify payment
    let verified = false;
    if (paymentProvider.toLowerCase() === 'paystack') {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${paymentReference}`,
        { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
      );
      verified = response.data?.data?.status === 'success';
    } else if (paymentProvider.toLowerCase() === 'flutterwave') {
      const response = await axios.get(
        `https://api/flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${paymentReference}`,
        { headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` } }
      );
      verified = response.data?.status === 'success';
    }
    if (!verified) {
      return res.status(402).json({ error: 'Payment verification failed' });
    }

    // 3) State guard (optional, like your Chops flow)
    const addressParts = address.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    const stateKeywords = [
      'imo', 'imo state', 'lagos', 'lagos state',
      'fct', 'abuja', 'abuja fct', 'abia', 'abia state',
      'enugu', 'enugu state', 'rivers', 'rivers state',
      'kaduna', 'kaduna state'
    ];
    const matchedState = addressParts.find(part => stateKeywords.includes(part));
    if (!matchedState) {
      return res.status(400).json({
        error: 'Please include a valid Nigerian state in your address so we can confirm availability.',
      });
    }
    const userState = normalizeState(matchedState);

    if (gift.deliveryStates?.length > 0 && !gift.deliveryStates.includes(userState)) {
      return res.status(403).json({ error: `Delivery is not available in ${userState.toUpperCase()}` });
    }
    if (gift.unavailableStates?.includes(userState)) {
      return res.status(403).json({ error: `This gift is temporarily unavailable in ${userState.toUpperCase()}` });
    }

    // 4) Save booking
    const booking = await GiftBooking.create({
      gift: giftId,
      fullName,
      email,
      phone,
      address,
      quantity,
      total,
      paymentReference,
      paymentProvider,
    });

    // 📧 ADDED — send booking confirmation (user + BCC vendor/admin if available)
    try {
      let vendorEmail = null;
      try {
        if (gift.vendorId) {
          const v = await Vendor.findById(gift.vendorId).select('email').lean();
          vendorEmail = v?.email || null;
        }
      } catch (_) { /* soft fail on vendor lookup */ }

      await sendBookingEmails({
        category: 'gifts',                   // normalized category label
        title: gift.name || 'Gift',
        userEmail: email,
        vendorEmail,
        adminEmail: process.env.BOOKINGS_ADMIN_EMAIL, // optional BCC
        fullName,
        phone,
        amount: total,
        paymentReference,
        // extra context (util safely ignores unknown fields)
        quantity,
        address
      });
    } catch (e) {
      console.warn('⚠️ sendBookingEmails(gifts):', e?.message || e);
    }

    res.status(201).json({ message: '✅ Booking saved successfully', booking });
  } catch (err) {
    console.error('❌ Booking save error:', err.message);
    res.status(500).json({ error: 'Could not save booking' });
  }
});

module.exports = router;

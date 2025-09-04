const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');

const Vendor = require('../models/vendorModel');

// Booking models (legacy/compat)
const Room = require('../models/roomModel');
const HotelBooking = require('../models/hotelBookingModel');
const Shortlet = require('../models/shortletModel');
const ShortletBooking = require('../models/shortletBookingModel');

const EventCenter = require('../models/eventCenterModel');
const EventCenterBooking = require('../models/eventCenterBookingModel');

const Restaurant = require('../models/restaurantModel');
const RestaurantBooking = require('../models/restaurantBookingModel');

const Ledger = require('../models/ledgerModel');
const Payout = require('../models/payoutModel');

const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// NEW: email for KYC file submissions to admin
const nodemailer = require('nodemailer');
const crypto = require('crypto'); // ⬅️ for duplicate detection

// Mature vendor rows before calculating balances
const { releaseDueForVendor } = require('../services/ledgerService');

// Some optional models referenced in delete-account (guarded with safeRequire)
function safeRequire(p) { try { return require(p); } catch { return null; } }
const TourGuide = safeRequire('../models/tourGuideModel');
const TourGuideBooking = safeRequire('../models/tourGuideBookingModel');

// ---------- Cloudinary ----------
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (result) resolve(result.secure_url);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------- Email (admin) ----------
function makeMailTransport() {
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  const hasSmtpHost = !!(process.env.SMTP_HOST);

  if (hasGmail) {
    console.info('[mail] Using Gmail SMTP (smtp.gmail.com:465 secure)');
    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }

  if (hasSmtpHost) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    console.info(`[mail] Using custom SMTP ${process.env.SMTP_HOST}:${port} secure=${secure}`);
    const conf = { host: process.env.SMTP_HOST, port, secure };
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      conf.auth = { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
    }
    return nodemailer.createTransport(conf);
  }

  console.warn('[mail] No mail creds found; using jsonTransport (no network).');
  return nodemailer.createTransport({ jsonTransport: true });
}
const transporter = makeMailTransport();
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hotelpennies.com';
const FROM_EMAIL  = process.env.FROM_EMAIL
  || process.env.GMAIL_USER
  || process.env.SMTP_USER
  || 'no-reply@hotelpennies.local';

// ---------- DEBUG: log every request ----------
router.use((req, _res, next) => {
  console.log(
    `[VendorRouter] ${new Date().toISOString()} ${req.method} ${req.originalUrl} | Auth:`,
    req.headers.authorization ? '(present)' : '(none)'
  );
  next();
});

// ---------- helpers ----------
const COMPANY_SUFFIXES = [
  'ltd', 'limited', 'inc', 'co', 'company', 'nigeria limited', 'plc', 'llc', 'intl', 'international'
];

const normalizeName = (s = '') => {
  let t = String(s).toLowerCase();
  t = t.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const parts = t.split(/\s+/).filter(Boolean).filter(w => !COMPANY_SUFFIXES.includes(w));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

const BANK_CODE_MAP = {
  'access bank': '044',
  'zenith bank': '057',
  'guaranty trust bank': '058',
  'gtbank': '058',
  'first bank': '011',
  'uba': '033',
  'fidelity bank': '070',
  'union bank': '032',
  'polaris bank': '076',
  'fcmb': '214',
  'sterling bank': '232',
  'wema bank': '035',
  'keystone bank': '082',
  'stanbic ibtc bank': '221',
  'ecobank': '050',
};

const guessBankCode = (bankName = '') => {
  const k = bankName.toLowerCase().trim();
  const found = Object.keys(BANK_CODE_MAP).find(key => k.includes(key));
  return found ? BANK_CODE_MAP[found] : null;
};

const ensurePayoutAccountFields = (acc) => {
  acc.bankName = acc.bankName || '';
  acc.accountNumber = acc.accountNumber || '';
  acc.accountName = acc.accountName || '';
  if (acc.bankCode === undefined) acc.bankCode = null;
  if (acc.recipientCode === undefined) acc.recipientCode = null;
  if (acc.isLocked === undefined) acc.isLocked = false;
};

const getLockedAccount = (vendor) => {
  const idx = Number.isInteger(vendor.lockedPayoutAccountIndex)
    ? vendor.lockedPayoutAccountIndex
    : -1;
  const arr = Array.isArray(vendor.payoutAccounts) ? vendor.payoutAccounts : [];
  if (idx >= 0 && idx < arr.length) return { account: arr[idx], index: idx };
  return { account: null, index: -1 };
};

// ⬇️⬇️ NEW: minimal additions for internal withdraw (no external provider) ⬇️⬇️
const MIN_PAYOUT_NGN = Number(process.env.MIN_PAYOUT_NGN || 5000);

async function getAvailableBalanceVendor(idStr) {
  const accountId = new mongoose.Types.ObjectId(idStr);
  const rows = await Ledger.aggregate([
    { $match: { accountType: 'vendor', accountId, status: 'available' } },
    { $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$direction','credit'] }, '$amount', 0] } },
        debits:  { $sum: { $cond: [{ $eq: ['$direction','debit']  }, '$amount', 0] } },
    } }
  ]);
  const r = rows[0] || { credits: 0, debits: 0 };
  return (r.credits || 0) - (r.debits || 0);
}
// ⬆️⬆️ END additions ⬆️⬆️

// ---------- DASHBOARD ----------
router.get('/dashboard', auth, async (req, res) => {
  try {
    const vendorId = req.user?._id;
    if (!vendorId) return res.status(401).json({ message: 'Unauthorized: Vendor ID missing' });

    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // 🔁 Mature vendor rows before calculating balances
    await releaseDueForVendor(vendorId).catch(() => {});

    // 🔒 Compute verification flags so the banner can disappear when admin approves
    const docs = vendor.documents || {};
    const docsOk   = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
    const approved = String(vendor.kycStatus || '').toUpperCase() === 'APPROVED';
    const computedIsFullyVerified = !!(vendor.isFullyVerified || approved || docsOk);

    const vendorRooms = await Room.find({ vendorId }).select('_id').lean();
    const roomIds = vendorRooms.map(r => String(r._id));
    const hotelPaidActive = await HotelBooking.find({
      paymentStatus: 'paid',
      room: { $in: roomIds },
      canceled: { $ne: true },
    }).select('_id price').lean();

    const vendorShortlets = await Shortlet.find({ vendorId }).select('_id').lean();
    const shortletIds = vendorShortlets.map(s => String(s._id));
    const shortletPaidActive = await ShortletBooking.find({
      paymentStatus: 'paid',
      shortlet: { $in: shortletIds },
      canceled: { $ne: true },
    }).select('_id price').lean();

    const vendorECs = await EventCenter.find({ vendorId }).select('_id').lean();
    const ecIds = vendorECs.map(e => String(e._id));
    const ecCountActive = await EventCenterBooking.countDocuments({
      eventCenterId: { $in: ecIds },
      canceled: { $ne: true },
    });

    const vendorRestaurants = await Restaurant.find({ vendorId }).select('_id').lean();
    const restaurantIds = vendorRestaurants.map(r => String(r._id));
    const restCountActive = await RestaurantBooking.countDocuments({
      restaurant: { $in: restaurantIds },
      canceled: { $ne: true },
    });

    let tourCountActive = 0;
    if (TourGuide && TourGuideBooking) {
      const guides = await TourGuide.find({ vendorId }).select('_id').lean();
      const guideIds = guides.map(g => g._id);
      if (guideIds.length) {
        tourCountActive = await TourGuideBooking.countDocuments({
          guideId: { $in: guideIds },
          paymentStatus: 'paid',
          canceled: { $ne: true },
        });
      }
    }

    const [
      hotelCancelledCount,
      shortletCancelledCount,
      ecCancelledCount,
      restCancelledCount,
      tourCancelledCount,
    ] = await Promise.all([
      HotelBooking.countDocuments({ room: { $in: roomIds }, canceled: true }),
      ShortletBooking.countDocuments({ shortlet: { $in: shortletIds }, canceled: true }),
      EventCenterBooking.countDocuments({ eventCenterId: { $in: ecIds }, canceled: true }),
      RestaurantBooking.countDocuments({ restaurant: { $in: restaurantIds }, canceled: true }),
      (async () => {
        if (TourGuide && TourGuideBooking) {
          const guides = await TourGuide.find({ vendorId }).select('_id').lean();
          const gids = guides.map(g => g._id);
          if (gids.length) {
            return TourGuideBooking.countDocuments({ guideId: { $in: gids }, canceled: true });
          }
        }
        return 0;
      })(),
    ]);

    const totalBookings = hotelPaidActive.length + shortletPaidActive.length + ecCountActive + restCountActive + tourCountActive;
    const totalCancelledBookings = hotelCancelledCount + shortletCancelledCount + ecCancelledCount + restCancelledCount + tourCancelledCount;

    const id = new mongoose.Types.ObjectId(vendorId);

    const ledgerAvailableAgg = await Ledger.aggregate([
      { $match: { accountType: 'vendor', accountId: id, status: 'available' } },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'meta.cancelOf',
          foreignField: '_id',
          as: 'base'
        }
      },
      { $unwind: { path: '$base', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          _include: {
            $cond: [
              { $ne: ['$reason', 'adjustment'] },
              true,
              { $and: [
                  { $ne: ['$base', null] },
                  { $eq: ['$base.reason', 'vendor_share'] }
                ] }
            ]
          }
        }
      },
      { $match: { _include: true } },
      {
        $group: {
          _id: null,
          credit: { $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$amount', 0] } },
          debit:  { $sum: { $cond: [{ $eq: ['$direction', 'debit']  }, '$amount', 0] } },
        },
      },
      { $project: { amount: { $subtract: ['$credit', '$debit'] } } },
    ]);
    const payableBalance = Number(ledgerAvailableAgg[0]?.amount || 0);

    const pendingVendorShareAgg = await Ledger.aggregate([
      { $match: {
          accountType: 'vendor',
          accountId: id,
          status: 'pending',
          reason: 'vendor_share',
          direction: 'credit'
      }},
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const vendorSharePendingNet = Number(pendingVendorShareAgg[0]?.total || 0);

    const [lifeGrossAgg, lifeCancelRevAgg, lifeOtherAdjAgg] = await Promise.all([
      Ledger.aggregate([
        { $match: { accountType: 'vendor', accountId: id, reason: 'vendor_share', direction: 'credit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Ledger.aggregate([
        { $match: {
            accountType: 'vendor', accountId: id,
            reason: 'adjustment', direction: 'debit',
            'meta.cancelOf': { $exists: true }
        }}],
      ).then(() => Ledger.aggregate([
        { $match: {
            accountType: 'vendor', accountId: id,
            reason: 'adjustment', direction: 'debit',
            'meta.cancelOf': { $exists: true }
        }},
        { $lookup: { from: 'ledgers', localField: 'meta.cancelOf', foreignField: '_id', as: 'base' } },
        { $unwind: { path: '$base', preserveNullAndEmptyArrays: false } },
        { $match: { 'base.reason': 'vendor_share' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])),
      Ledger.aggregate([
        { $match: {
            accountType: 'vendor', accountId: id,
            reason: 'adjustment', direction: 'debit',
            $or: [{ 'meta.cancelOf': { $exists: false } }, { 'meta.cancelOf': null }]
        }}],
      ).then(() => Ledger.aggregate([
        { $match: {
            accountType: 'vendor', accountId: id,
            reason: 'adjustment', direction: 'debit',
            $or: [{ 'meta.cancelOf': { $exists: false } }, { 'meta.cancelOf': null }]
        }},
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])),
    ]);
    const lifetimeVendorGross = Number(lifeGrossAgg[0]?.total || 0);
    const lifetimeVendorReversedFromCancellations = Number(lifeCancelRevAgg[0]?.total || 0);
    const lifetimeVendorOtherAdjustments = Number(lifeOtherAdjAgg[0]?.total || 0);
    const lifetimeVendorNet = lifetimeVendorGross - (lifetimeVendorReversedFromCancellations + lifeOtherAdjAgg[0]?.total || 0);

    // Payouts summary
    const [aggPending, aggPaid] = await Promise.all([
      Payout.aggregate([
        { $match: {
            payeeType: 'vendor',
            vendorId: id,
            status: { $in: ['submitted','requested','approved','pending','processing'] }
        }},
        { $group: { _id: null, total: { $sum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } } } } }
      ]),
      Payout.aggregate([
        { $match: { payeeType: 'vendor', vendorId: id, status: 'paid' } },
        { $group: { _id: null, total: { $sum: { $convert: { input: '$amount', to: 'double', onError: 0, onNull: 0 } } } } }
      ])
    ]);
    const pendingProcessing = Number(aggPending[0]?.total || 0);
    const paidOut = Number(aggPaid[0]?.total || 0);

    // Quick finish to keep file consistent with your version:
    res.json({
      vendor: {
        _id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        isFullyVerified: computedIsFullyVerified, // ✅ banner logic now correct
        payoutAccounts: (vendor.payoutAccounts || []),
        payoutHistory: vendor.payoutHistory || [],
        lockedPayoutAccountIndex: Number.isInteger(vendor.lockedPayoutAccountIndex)
          ? vendor.lockedPayoutAccountIndex
          : null,
      },
      stats: {
        totalBookings,
        cancelledBookings: hotelCancelledCount + shortletCancelledCount + ecCancelledCount + restCancelledCount + tourCancelledCount,
        totalRevenue: lifetimeVendorNet,
      },
      vendorStats: {
        pendingProcessing,
        payableBalance,
        paidOut,
        vendorSharePendingNet,
        lifetimeVendorGross,
        lifetimeVendorReversedFromCancellations,
        lifetimeVendorOtherAdjustments,
        lifetimeVendorNet,
        cancellations: { count: 0, amount: 0, recent: [] }, // keep structure
      },
    });
  } catch (err) {
    console.error('❌ Dashboard fetch failed:', err);
    res.status(500).json({ message: 'Dashboard fetch failed' });
  }
});

// ---------- UNIFIED BOOKINGS (unchanged) ----------
router.get('/bookings', auth, async (req, res) => {
  try {
    const vendorId = req.user?._id;

    const rooms = await Room.find({ vendorId }).select('_id name').lean();
    const roomById = Object.fromEntries(rooms.map(r => [String(r._id), r]));
    const hotelBookings = await HotelBooking
      .find({ room: { $in: rooms.map(r => r._id) }, paymentStatus: 'paid' })
      .select('fullName email phone checkIn checkOut price guests room paymentStatus createdAt canceled')
      .lean();
    const hotelRows = hotelBookings.map(b => {
      const r = roomById[String(b.room)];
      return {
        category: 'hotel',
        listingName: r?.name || 'Hotel Room',
        buyerName: b.fullName,
        buyerEmail: b.email,
        buyerPhone: b.phone,
        guests: Number(b.guests) || 0,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        price: b.price,
        status: b.canceled ? 'cancelled' : (b.paymentStatus || 'paid'),
        createdAt: b.createdAt,
      };
    });

    const shortlets = await Shortlet.find({ vendorId }).select('_id title').lean();
    const shortletById = Object.fromEntries(shortlets.map(s => [String(s._id), s]));
    const sBookings = await ShortletBooking
      .find({ shortlet: { $in: shortlets.map(s => s._id) }, paymentStatus: 'paid' })
      .select('fullName email phone checkIn checkOut price guests shortlet paymentStatus createdAt canceled')
      .lean();
    const shortletRows = sBookings.map(b => {
      const s = shortletById[String(b.shortlet)];
      return {
        category: 'shortlet',
        listingName: s?.title || 'Shortlet',
        buyerName: b.fullName,
        buyerEmail: b.email,
        buyerPhone: b.phone,
        guests: Number(b.guests) || 0,
        checkIn: b.checkIn,
        checkOut: null,
        price: b.price,
        status: b.canceled ? 'cancelled' : (b.paymentStatus || 'paid'),
        createdAt: b.createdAt,
      };
    });

    const ecenters = await EventCenter.find({ vendorId }).select('_id name').lean();
    const ecById = Object.fromEntries(ecenters.map(e => [String(e._id), e]));
    const ecBookings = await EventCenterBooking
      .find({ eventCenterId: { $in: ecenters.map(e => e._id) } })
      .select('fullName email phone eventDate guests amount createdAt eventCenterId canceled')
      .lean();
    const ecRows = ecBookings.map(b => {
      const e = ecById[String(b.eventCenterId)];
      return {
        category: 'eventcenter',
        listingName: e?.name || 'Event Center',
        buyerName: b.fullName,
        buyerEmail: b.email,
        buyerPhone: b.phone,
        guests: Number(b.guests) || 0,
        checkIn: b.eventDate,
        checkOut: null,
        price: b.amount,
        status: b.canceled ? 'cancelled' : 'paid',
        createdAt: b.createdAt,
      };
    });

    const restaurants = await Restaurant.find({ vendorId }).select('_id name').lean();
    const restById = Object.fromEntries(restaurants.map(r => [String(r._id), r]));
    const restBookings = await RestaurantBooking
      .find({ restaurant: { $in: restaurants.map(r => r._id) } })
      .select('fullName email phone guests reservationTime totalPrice bookingType paymentStatus createdAt restaurant canceled')
      .lean();
    const restRows = restBookings.map(b => {
      const r = restById[String(b.restaurant)];
      return {
        category: 'restaurant',
        listingName: r?.name || 'Restaurant',
        buyerName: b.fullName,
        buyerEmail: b.email,
        buyerPhone: b.phone,
        guests: Number(b.guests) || 0,
        checkIn: b.reservationTime || b.createdAt,
        checkOut: null,
        price: b.totalPrice,
        status: b.canceled ? 'cancelled' : (b.paymentStatus || 'paid'),
        createdAt: b.createdAt,
        bookingType: b.bookingType,
      };
    });

    let tourRows = [];
    if (TourGuide && TourGuideBooking) {
      const guides = await TourGuide.find({ vendorId }).select('_id name title').lean();
      if (guides.length) {
        const guideMap = Object.fromEntries(guides.map(g => [String(g._id), g]));
        const tBookings = await TourGuideBooking
          .find({ guideId: { $in: guides.map(g => g._id) }, paymentStatus: 'paid' })
          .select('fullName email phone numberOfGuests tourDate totalPrice paymentStatus createdAt guideId canceled')
          .lean();
        tourRows = tBookings.map(b => {
          const g = guideMap[String(b.guideId)];
          return {
            category: 'tourguide',
            listingName: g?.name || g?.title || 'Tour Guide',
            buyerName: b.fullName,
            buyerEmail: b.email,
            buyerPhone: b.phone,
            guests: Number(b.numberOfGuests || 0),
            checkIn: b.tourDate,
            CheckOut: null,
            price: b.totalPrice,
            status: b.canceled ? 'cancelled' : (b.paymentStatus || 'paid'),
            createdAt: b.createdAt,
          };
        });
      }
    }

    const rows = [...hotelRows, ...shortletRows, ...ecRows, ...restRows, ...tourRows].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(rows);
  } catch (err) {
    console.error('❌ Failed to fetch vendor bookings:', err);
    res.status(500).json({ message: 'Failed to fetch bookings' });
  }
});

// ---------- PROFILE / DOCS / ACCOUNTS (unchanged) ----------
router.get('/profile', auth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.user._id).lean();
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    const docs = v.documents || {};
    const docsOk   = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
    const approved = String(v.kycStatus || '').toUpperCase() === 'APPROVED';

    // 👇 computed flag: unlock if admin-approved OR docs complete OR old flag already true
    const isFullyVerified = !!(v.isFullyVerified || approved || docsOk);

    res.json({ ...v, isFullyVerified });
  } catch (err) {
    console.error('❌ Error in /profile:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/upload-document', auth, upload.single('document'), async (req, res) => {
  try {
    const { field } = req.body;
    const allowedFields = ['meansOfId', 'cacCertificate', 'proofOfAddress'];
    if (!allowedFields.includes(field)) {
      return res.status(400).json({ message: 'Invalid field' });
    }

    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const cloudinaryUrl = await uploadToCloudinary(req.file.buffer, 'vendor_documents');
    vendor.documents = vendor.documents || {};
    vendor.documents[field] = cloudinaryUrl;

    const { meansOfId, cacCertificate, proofOfAddress } = vendor.documents;
    vendor.isFullyVerified = Boolean(meansOfId && cacCertificate && proofOfAddress);

    await vendor.save();
    res.json({ message: 'Document uploaded successfully', vendor });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Document upload failed' });
  }
});

router.put('/update-profile', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    vendor.name = req.body.name || vendor.name;
    vendor.email = req.body.email || vendor.email;
    vendor.phone = req.body.phone || vendor.phone;
    vendor.address = req.body.address || vendor.address;

    await vendor.save();
    res.json({ updatedVendor: vendor });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// ---------- KYC STATUS (reflect admin approval) ----------
router.get('/kyc/status', auth, async (req, res) => {
  try {
    const v = await Vendor.findById(req.user._id).lean();
    if (!v) return res.status(404).json({ message: 'Vendor not found' });

    const docs = v.documents || {};
    const docsOk   = !!(docs.meansOfId && docs.cacCertificate && docs.proofOfAddress);
    const approved = String(v.kycStatus || '').toUpperCase() === 'APPROVED';

    // Keep your existing response shape, but make it reflect approval
    res.json({
      kycStatus: approved ? 'APPROVED' : (v.kycStatus || 'PENDING'),
      checks: v.kyc?.checks || {},
      isFullyVerified: !!(v.isFullyVerified || approved || docsOk),
    });
  } catch (err) {
    console.error('kyc/status error:', err);
    res.status(500).json({ message: 'Failed to get KYC status' });
  }
});

// ---------- KYC SUBMIT (unchanged) ----------
router.post('/kyc/submit', auth, express.json(), async (req, res) => {
  try {
    const { idType = 'none', idNumber = '', cacNumber = '' } = req.body || {};
    const allowed = ['nin', 'passport', 'none'];
    if (!allowed.includes(String(idType))) {
      return res.status(400).json({ message: 'Invalid idType. Use nin, passport or none.' });
    }

    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    vendor.kyc = vendor.kyc || {};
    vendor.kyc.idType = idType;
    vendor.kyc.idNumber = idType === 'none' ? '' : String(idNumber || '').trim();
    vendor.kyc.cacNumber = String(cacNumber || '').trim();
    vendor.kyc.checks = vendor.kyc.checks || {};

    const now = new Date();

    if (idType !== 'none') {
      vendor.kyc.checks.identity = {
        status: 'processing',
        note: '',
        provider: 'kycguard',
        updatedAt: now,
      };
    }

    if (vendor.kyc.cacNumber) {
      vendor.kyc.checks.company = {
        status: 'processing',
        note: '',
        provider: 'kycguard',
        updatedAt: now,
      };
    }

    vendor.kycStatus = 'PROCESSING';
    await vendor.save();

    res.json({ message: 'Verification started', kycStatus: vendor.kycStatus });
  } catch (err) {
    console.error('kyc/submit error:', err);
    res.status(500).json({ message: 'Failed to start verification' });
  }
});

// ---------- KYC: submit files to admin (EMAIL) ----------
router.post(
  '/kyc/submit-files',
  auth,
  upload.fields([
    { name: 'meansOfId',      maxCount: 1 },
    { name: 'cacCertificate', maxCount: 1 },
    { name: 'proofOfAddress', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const vendor = await Vendor.findById(req.user._id);
      if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

      // Block re-submission if any doc already present in DB
      if (vendor.documents?.meansOfId || vendor.documents?.cacCertificate || vendor.documents?.proofOfAddress) {
        return res.status(409).json({
          ok: false,
          code: 'ALREADY_SUBMITTED',
          message: 'Documents already submitted. Please wait for review or contact support to update.'
        });
      }

      const f = req.files || {};
      const mId  = (f.meansOfId      && f.meansOfId[0])      || null;
      const cac  = (f.cacCertificate && f.cacCertificate[0]) || null;
      const poa  = (f.proofOfAddress && f.proofOfAddress[0]) || null;

      // Require all three
      if (!(mId && cac && poa)) {
        return res.status(400).json({ message: 'Attach Means of ID, CAC Certificate, and Proof of Address.' });
      }

      // 🔒 Reject duplicates within the same submission (same bytes)
      const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
      const entries = [
        { key: 'meansOfId', file: mId },
        { key: 'cacCertificate', file: cac },
        { key: 'proofOfAddress', file: poa },
      ];
      const seen = new Map();
      const dups = [];
      for (const { key, file } of entries) {
        const sig = hash(file.buffer);
        if (seen.has(sig)) dups.push([seen.get(sig), key]);
        else seen.set(sig, key);
      }
      if (dups.length) {
        const pairs = dups.map(([a,b]) => `${a} & ${b}`).join(', ');
        return res.status(400).json({
          ok: false,
          code: 'DUPLICATE_FILES',
          message: `You can't upload the same document twice (${pairs}). Please attach three distinct documents: Means of ID, CAC Certificate, and Proof of Address.`
        });
      }

      // Email admin with attachments
      const attachments = [
        { filename: `meansOfId__${mId.originalname}`,      content: mId.buffer, contentType: mId.mimetype || 'application/octet-stream' },
        { filename: `cacCertificate__${cac.originalname}`, content: cac.buffer, contentType: cac.mimetype || 'application/octet-stream' },
        { filename: `proofOfAddress__${poa.originalname}`, content: poa.buffer, contentType: poa.mimetype || 'application/octet-stream' },
      ];

      await transporter.sendMail({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `Vendor KYC submission – ${vendor.name || vendor.email || vendor._id}`,
        text: [
          `Vendor: ${vendor.name || '-'}`,
          `Email: ${vendor.email || '-'}`,
          `Phone: ${vendor.phone || '-'}`,
          `Address: ${vendor.address || '-'}`,
          '',
          'Documents attached: Means of ID, CAC Certificate, Proof of Address.',
        ].join('\n'),
        attachments,
      });

      if (vendor.kycStatus !== 'APPROVED') vendor.kycStatus = 'PROCESSING';
      await vendor.save();

      res.json({ ok: true, message: 'Documents sent. Approval in process.' });
    } catch (err) {
      console.error('kyc/submit-files error:', err);
      res.status(500).json({ message: 'Failed to submit documents.' });
    }
  }
);

// ---------- payout accounts / withdraw / webhook / delete (unchanged) ----------
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const ensureRecipient = async ({ accountName, accountNumber, bankCode, recipientCode }) => {
  if (recipientCode) return recipientCode;
  const resp = await axios.post(
    'https://api.paystack.co/transferrecipient',
    {
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    },
    { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
  );
  return resp.data?.data?.recipient_code;
};

router.put('/payout-accounts', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const accounts = Array.isArray(req.body.accounts) ? req.body.accounts : [];
    const vn = normalizeName(vendor.name);

    const cleaned = accounts.map(a => {
      const item = {
        bankName: a.bankName || '',
        accountNumber: a.accountNumber || '',
        accountName: a.accountName || '',
        bankCode: a.bankCode || guessBankCode(a.bankName || '') || null,
        recipientCode: a.recipientCode || null,
        isLocked: false,
      };
      const an = normalizeName(item.accountName);
      if (an !== vn) {
        if (!(an.includes(vn) || vn.includes(an))) {
          throw new Error('Account name must match business name (minor variations like "Ltd" allowed).');
        }
      }
      return item;
    });

    vendor.payoutAccounts = cleaned;
    await vendor.save();
    res.json({ accounts: vendor.payoutAccounts });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Failed to update payout accounts' });
  }
});

router.post('/lock-payout-account', auth, async (req, res) => {
  try {
    const { index } = req.body;
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const arr = Array.isArray(vendor.payoutAccounts) ? vendor.payoutAccounts : [];
    if (index < 0 || index >= arr.length) {
      return res.status(400).json({ message: 'Invalid account index' });
    }

    ensurePayoutAccountFields(arr[index]);
    if (!arr[index].bankCode) {
      const code = guessBankCode(arr[index].bankName);
      if (!code) return res.status(400).json({ message: 'Unknown bank — please enter a known bank name' });
      arr[index].bankCode = code;
    }

    vendor.payoutAccounts = arr.map((a, i) => ({ ...a, isLocked: i === index }));
    vendor.lockedPayoutAccountIndex = index;
    await vendor.save();

    res.json({
      message: 'Payout account locked',
      lockedPayoutAccountIndex: vendor.lockedPayoutAccountIndex,
      payoutAccounts: vendor.payoutAccounts
    });
  } catch (err) {
    console.error('Lock account error:', err);
    res.status(500).json({ message: 'Failed to lock payout account' });
  }
});

router.post('/unlock-payout-account', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    vendor.payoutAccounts = (vendor.payoutAccounts || []).map(a => ({ ...a, isLocked: false }));
    vendor.lockedPayoutAccountIndex = null;
    await vendor.save();
    res.json({ message: 'Payout account unlocked' });
  } catch (err) {
    console.error('Unlock account error:', err);
    res.status(500).json({ message: 'Failed to unlock' });
  }
});

router.post('/request-payout', auth, async (req, res) => {
  try {
    const { amount, account } = req.body;
    const vendor = await Vendor.findById(req.user._id);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    if (Number(amount) < 5000) {
      return res.status(400).json({ message: 'Minimum payout is ₦5000' });
    }

    vendor.payoutHistory = vendor.payoutHistory || [];
    vendor.payoutHistory.push({
      amount: Number(amount),
      account: account || {},
      date: new Date(),
      status: 'Pending',
    });

    await vendor.save();
    res.json({ message: 'Payout request submitted', status: 'Pending' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to process payout request' });
  }
});

// ⬇️⬇️ REPLACED: INTERNAL withdraw (no external provider calls) ⬇️⬇️
router.post('/withdraw', auth, async (req, res) => {
  try {
    const vendorId = req.user?._id;
    if (!vendorId) return res.status(401).json({ message: 'Unauthorized' });

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    // must have a locked payout account on file
    const { account: locked } = getLockedAccount(vendor);
    if (!locked) return res.status(400).json({ message: 'No locked payout account. Lock one first.' });

    // current available (already net of any previous payout locks)
    const available = await getAvailableBalanceVendor(vendorId);

    // support "all" or a number
    const raw = req.body?.amount;
    const amount = Math.round(
      raw == null || String(raw).toLowerCase() === 'all' ? available : Number(raw)
    );

    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'No payable balance available' });
    }
    if (amount < MIN_PAYOUT_NGN) {
      return res.status(400).json({ message: `Minimum payout is ₦${MIN_PAYOUT_NGN.toLocaleString()}` });
    }
    if (amount > available) {
      return res.status(400).json({ message: `Amount exceeds available balance (₦${available.toLocaleString()})` });
    }

    // snapshot bank fields (no network calls)
    const bank = {
      bankName: locked.bankName || '',
      bankCode: locked.bankCode || null,
      accountNumber: locked.accountNumber || '',
      accountName: locked.accountName || '',
    };

    // create internal payout in "requested"
    const payout = await Payout.create({
      payeeType: 'vendor',
      vendorId,
      amount,
      currency: 'NGN',
      status: 'requested',
      method: 'manual',
      requestedBy: vendorId,
      balanceAtRequest: available,
      bank,
      meta: { source: 'vendor_dashboard' },
    });

    // lock funds now with a ledger debit (reduces available immediately)
    await Ledger.create({
      accountType: 'vendor',
      accountModel: 'Vendor',
      accountId: vendorId,
      sourceType: 'payout',
      sourceModel: 'Payout',
      sourceId: payout._id,
      direction: 'debit',
      amount,
      currency: 'NGN',
      status: 'available',
      releaseOn: null,
      reason: 'payout',
      meta: { payoutId: payout._id, kind: 'lock' },
    });

    const newAvailable = await getAvailableBalanceVendor(vendorId);

    console.log('[VendorRouter] INTERNAL withdraw — created payout & lock', {
      payoutId: String(payout._id),
      amount,
      newAvailable,
    });

    // keep legacy response keys to avoid UI changes
    const reference = `manual_${payout._id.toString()}`;
    return res.status(201).json({
      message: 'Withdrawal initiated',
      status: 'processing',      // UI-friendly; actual DB status is "requested"
      reference,
      payoutId: payout._id,
      balances: { available: newAvailable, payableBalance: newAvailable },
    });
  } catch (err) {
    console.error('VENDOR INTERNAL WITHDRAW ERROR:', err?.message || err);
    res.status(500).json({ message: 'Withdrawal failed' });
  }
});
// ⬆️⬆️ END replacement ⬆️⬆️

router.post('/paystack/webhook', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const event = req.body || {};
    console.log('[VendorRouter] /paystack/webhook event:', event?.event);

    if (event?.event === 'transfer.success' || event?.event === 'transfer.failed' || event?.event === 'transfer.reversed') {
      const data = event.data || {};
      const ref = data.reference || data.transfer_code;

      const vendor = await Vendor.findOne({ 'payoutHistory.providerRef': ref });
      if (vendor) {
        const idx = vendor.payoutHistory.findIndex(p => p.providerRef === ref);
        if (idx >= 0) {
          let status = 'processing';
          if (event.event === 'transfer.success') status = 'paid';
          else if (event.event === 'transfer.failed' || event.event === 'transfer.reversed') status = 'failed';

          vendor.payoutHistory[idx].status = status;
          await vendor.save();
          console.log('[VendorRouter] webhook updated payout status to', status, 'for ref', ref);
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ received: false });
  }
});

router.delete('/delete-account', auth, async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user._id).exec();
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    const pendingBalance = (Array.isArray(vendor.payoutHistory) ? vendor.payoutHistory : [])
      .filter(p => ['pending', 'processing'].includes(String(p.status).toLowerCase()))
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);

    if (pendingBalance > 0) {
      return res.status(400).json({
        message: 'You have pending funds. Please withdraw remaining balance before deleting your account.'
      });
    }

    const now = new Date();

    const rooms = await Room.find({ vendorId: vendor._id }).select('_id').lean();
    const roomIds = rooms.map(r => r._id);
    const futureHotels = await HotelBooking.exists({
      room: { $in: roomIds },
      checkIn: { $gte: now },
      paymentStatus: 'paid'
    });

    const shortlets = await Shortlet.find({ vendorId: vendor._id }).select('_id').lean();
    const shortletIds = shortlets.map(s => s._id);
    const futureShortlets = await ShortletBooking.exists({
      shortlet: { $in: shortletIds },
      checkIn: { $gte: now },
      paymentStatus: 'paid'
    });

    const ecs = await EventCenter.find({ vendorId: vendor._id }).select('_id').lean();
    const ecIds = ecs.map(e => e._id);
    const futureEC = await EventCenterBooking.exists({
      eventCenterId: { $in: ecIds },
      eventDate: { $gte: now }
    });

    const restaurants = await Restaurant.find({ vendorId: vendor._id }).select('_id').lean();
    const restIds = restaurants.map(r => r._id);
    const futureRest = await RestaurantBooking.exists({
      restaurant: { $in: restIds },
      bookingType: 'reserve',
      reservationTime: { $gte: now },
      paymentStatus: { $in: ['paid','pending'] }
    });

    let futureTours = false;
    if (TourGuide && TourGuideBooking) {
      const guides = await TourGuide.find({ vendorId: vendor._id }).select('_id').lean();
      const guideIds = guides.map(g => g._id);
      futureTours = await TourGuideBooking.exists({
        guideId: { $in: guideIds },
        tourDate: { $gte: now },
        paymentStatus: { $in: ['paid','pending'] }
      });
    }

    if (futureHotels || futureShortlets || futureEC || futureRest || futureTours) {
      return res.status(400).json({
        message: 'You still have upcoming bookings. Please complete or cancel them before deleting your account.'
      });
    }

    vendor.status = 'closed';
    vendor.closedAt = new Date();

    const updates = [
      vendor.save(),
      Room.updateMany({ vendorId: vendor._id }, { $set: { available: false } }),
      Shortlet.updateMany({ vendorId: vendor._id }, { $set: { available: false } }),
      EventCenter.updateMany({ vendorId: vendor._id }, { $set: { available: false } }),
      Restaurant.updateMany({ vendorId: vendor._id }, { $set: { available: false } }),
    ];

    if (TourGuide) updates.push(TourGuide.updateMany({ vendorId: vendor._id }, { $set: { available: false } }));

    await Promise.all(updates);

    console.log('[VendorRouter] account closed for vendor', vendor._id.toString());
    return res.json({ message: 'Your account is now closed. Data is retained for audit and past payouts.' });
  } catch (err) {
    console.error('❌ delete-account error:', err);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;

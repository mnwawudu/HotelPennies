// routes/myOrdersRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

function safeRequire(p) { try { return require(p); } catch { return null; } }

const User                 = safeRequire('../models/userModel');
const Ledger               = safeRequire('../models/ledgerModel');

const HotelBooking         = safeRequire('../models/hotelBookingModel');
const ShortletBooking      = safeRequire('../models/shortletBookingModel');
const EventBooking         = safeRequire('../models/eventCenterBookingModel');
const RestaurantBooking    = safeRequire('../models/restaurantBookingModel');
const TourBooking          = safeRequire('../models/tourGuideBookingModel');
const ChopsBooking         = safeRequire('../models/chopsBookingModel');
const GiftBooking          = safeRequire('../models/giftBookingModel');

const Hotel                = safeRequire('../models/hotelModel');
const Room                 = safeRequire('../models/roomModel');
const Shortlet             = safeRequire('../models/shortletModel');
const EventCenter          = safeRequire('../models/eventCenterModel');
const Restaurant           = safeRequire('../models/restaurantModel');
const TourGuide            = safeRequire('../models/tourGuideModel');
const Chop                 = safeRequire('../models/chopModel');
const Gift                 = safeRequire('../models/giftModel');

// ---------- Auth ----------
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: 'Unauthorized' });

    const user = await User.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    req.user = {
      _id: user._id,
      email: String(user.email || '').toLowerCase(),
      phone: String(user.phone || ''),
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

// ---------- tiny safety wrapper so one failing block can't 500 everything ----------
const safe = async (fn, label = '') => {
  try { return await fn(); }
  catch (e) { console.warn('[myOrders] block failed:', label, e?.message || e); return []; }
};

// ---------- Helpers ----------
const nn = (v) => (v === undefined || v === null ? '' : v);
const toN = (v) => Number(v || 0);

function stripDigits(s) { return String(s || '').replace(/\D+/g, ''); }
function phoneVariants(phoneRaw) {
  const variants = new Set();
  const raw = String(phoneRaw || '').trim();
  if (!raw) return [];
  variants.add(raw);
  const digits = stripDigits(raw);
  if (!digits) return Array.from(variants);
  variants.add(digits);
  if (digits.startsWith('0') && digits.length >= 10) {
    const rest = digits.slice(1);
    variants.add('0' + rest); variants.add('234' + rest); variants.add('+234' + rest);
  } else if (digits.startsWith('234')) {
    const rest = digits.slice(3);
    variants.add('234' + rest); variants.add('+234' + rest); variants.add('0' + rest);
  } else if (digits.length === 10) {
    variants.add('0' + digits); variants.add('234' + digits); variants.add('+234' + digits);
  }
  if (raw.startsWith('+234')) variants.add(raw);
  if (!raw.startsWith('+') && digits.startsWith('234')) variants.add('+' + digits);
  return Array.from(variants);
}
function pseudoEmailVariantsFromPhone(phoneRaw) {
  return phoneVariants(phoneRaw).map(p => `${p}@hotelpennies.com`.toLowerCase());
}
function dedupe(arr) { return Array.from(new Set(arr.filter(Boolean))); }

async function pickName(model, id, field = 'name') {
  if (!model || !id) return '';
  try {
    const doc = await model.findById(id).select(field).lean();
    return nn(doc?.[field]);
  } catch { return ''; }
}

// ---- Money parsing (robust against "₦480,000" etc.) ----
function parseMoney(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  // Some libs send shapes like { amount: 12345, currency: 'NGN' }
  if (typeof val === 'object' && val !== null) {
    if (typeof val.amount === 'number') return Number.isFinite(val.amount) ? val.amount : 0;
    if (typeof val.amount === 'string') return parseMoney(val.amount);
  }
  return 0;
}

// First non-zero (or finite) amount across candidates
function pickMoney(...candidates) {
  // Prefer first positive amount
  for (const v of candidates) {
    if (v === undefined || v === null) continue;
    const n = parseMoney(v);
    if (n > 0) return n;
  }
  // Otherwise allow zero if that’s the only thing we have
  for (const v of candidates) {
    if (v === undefined || v === null) continue;
    const n = parseMoney(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

// include email + paymentReference on every mapped object
function baseMap(doc, extra = {}) {
  return {
    _id: doc._id,
    email: String(doc.email || '').toLowerCase(),
    paymentReference: nn(doc.paymentReference || doc.reference || doc.tx_ref),
    createdAt: doc.createdAt || doc.updatedAt || new Date(),
    paymentStatus: nn(doc.paymentStatus || 'paid'),
    canceled: !!doc.canceled,
    ...extra,
  };
}

// HOTEL amount resolver with rooms subtotal fallback (and robust parse)
function amountFromHotel(r) {
  const direct = pickMoney(r.total, r.totalPrice, r.price, r.amount, r.amountPaid, r.paidAmount);
  if (direct > 0) return direct;

  if (Array.isArray(r?.rooms) && r.rooms.length) {
    const sumSub = r.rooms.reduce((s, l) => s + parseMoney(l?.subtotal || l?.price || 0), 0);
    if (sumSub > 0) return sumSub;
  }
  return 0;
}

function buildSmartMatch(user) {
  const or = [];
  if (user._id) or.push({ userId: user._id });

  const emails = dedupe([String(user.email || '').toLowerCase()]).filter(Boolean);
  if (emails.length) {
    const emailFields = ['email', 'buyerEmail', 'userEmail', 'customerEmail', 'contactEmail'];
    for (const f of emailFields) or.push({ [f]: { $in: emails } });
  }

  const phones = dedupe(phoneVariants(user.phone));
  if (phones.length) {
    const phoneFields = ['phone', 'phoneNumber', 'contactPhone'];
    for (const f of phoneFields) or.push({ [f]: { $in: phones } });
  }

  const pseudoEmails = dedupe(pseudoEmailVariantsFromPhone(user.phone));
  if (pseudoEmails.length) {
    const emailFields = ['email', 'buyerEmail', 'userEmail', 'customerEmail', 'contactEmail'];
    for (const f of emailFields) or.push({ [f]: { $in: pseudoEmails } });
  }
  return or.length ? { $or: or } : {};
}

async function mapBookingToOrder(category, r) {
  switch (category) {
    case 'hotel': {
      const hotelName = await pickName(Hotel, r.hotel, 'name');
      let subTitle = await pickName(Room, r.room, 'name');
      if (!subTitle && Array.isArray(r.rooms) && r.rooms.length) {
        subTitle = r.rooms[0]?.roomTypeSnapshot || r.rooms[0]?.roomNameSnapshot || `${r.rooms.length} room(s)`;
      }
      return baseMap(r, {
        category: 'hotel',
        title: hotelName || 'Hotel',
        subTitle: subTitle || 'Room',
        amount: amountFromHotel(r),
        checkIn: r.checkIn,
        checkOut: r.checkOut,
      });
    }

    case 'shortlet': {
      const sName = await pickName(Shortlet, r.shortletId || r.shortlet, 'name');
      return baseMap(r, {
        category: 'shortlet',
        title: sName || 'Shortlet',
        amount: pickMoney(r.total, r.totalPrice, r.price, r.amount, r.amountPaid, r.paidAmount),
        checkIn: r.checkIn,
        checkOut: r.checkOut,
      });
    }

    case 'event': {
      const eName = await pickName(EventCenter, r.eventCenter || r.eventCenterId, 'name');
      return baseMap(r, {
        category: 'event',
        title: eName || 'Event Center',
        // robust amount calculation for event centers
        amount: pickMoney(r.total, r.totalAmount, r.totalPrice, r.price, r.amount, r.amountPaid, r.paidAmount),
        eventDate: r.eventDate || r.reservationTime,
      });
    }

    case 'restaurant': {
      const name = await pickName(Restaurant, r.restaurantId, 'name');
      return baseMap(r, {
        category: 'restaurant',
        title: name || 'Restaurant',
        amount: pickMoney(r.totalPrice, r.total, r.price, r.amount, r.amountPaid, r.paidAmount),
        reservationTime: r.reservationTime,
      });
    }

    case 'tour': {
      const gName = await pickName(TourGuide, r.guideId, 'name');
      return baseMap(r, {
        category: 'tour',
        title: gName || 'Tour Guide',
        amount: pickMoney(r.totalPrice, r.total, r.price, r.amount, r.amountPaid, r.paidAmount),
        tourDate: r.tourDate,
      });
    }

    case 'chops': {
      const cName = await pickName(Chop, r.chop, 'name');
      return baseMap(r, {
        category: 'chops',
        title: cName || 'Chops',
        amount: pickMoney(r.total, r.amount, r.price, r.amountPaid),
      });
    }

    case 'gifts': {
      const gName = await pickName(Gift, r.gift, 'name');
      return baseMap(r, {
        category: 'gifts',
        title: gName || 'Gift',
        amount: pickMoney(r.total, r.amount, r.price, r.amountPaid),
      });
    }

    default:
      return baseMap(r, { category: 'other', title: 'Order', amount: pickMoney(r.total, r.price, r.amount) });
  }
}

async function findBookingByIdAcross(id) {
  const tries = [
    { cat: 'hotel',      M: HotelBooking },
    { cat: 'shortlet',   M: ShortletBooking },
    { cat: 'event',      M: EventBooking },
    { cat: 'restaurant', M: RestaurantBooking },
    { cat: 'tour',       M: TourBooking },
    { cat: 'chops',      M: ChopsBooking },
    { cat: 'gifts',      M: GiftBooking },
  ].filter(t => t.M);

  for (const t of tries) {
    try {
      const doc = await t.M.findById(id).lean();
      if (doc) return { category: t.cat, doc };
    } catch (_) {}
  }
  return null;
}

async function findBookingByReferenceAcross(reference) {
  if (!reference) return null;
  const ref = String(reference).trim();

  const candidates = [
    { cat: 'hotel',      M: HotelBooking },
    { cat: 'shortlet',   M: ShortletBooking },
    { cat: 'event',      M: EventBooking },
    { cat: 'restaurant', M: RestaurantBooking },
    { cat: 'tour',       M: TourBooking },
    { cat: 'chops',      M: ChopsBooking },
    { cat: 'gifts',      M: GiftBooking },
  ].filter(t => t.M);

  const refFields = [
    'paymentReference', 'reference', 'ref', 'paymentRef',
    'transactionReference', 'transaction_ref', 'tx_ref', 'txRef',
    'paystack.reference', 'metadata.reference',
  ];

  for (const t of candidates) {
    const $or = refFields.map((f) => ({ [f]: ref }));
    try {
      const doc = await t.M.findOne({ $or }).exec();
      if (doc) return { category: t.cat, doc };
    } catch (_) {}
  }

  // fuzzy fallback
  for (const t of candidates) {
    try {
      const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const doc = await t.M.findOne({
        $or: [
          { paymentReference: { $regex: esc, $options: 'i' } },
          { reference:        { $regex: esc, $options: 'i' } },
        ]
      }).exec();
      if (doc) return { category: t.cat, doc };
    } catch (_) {}
  }
  return null;
}

/* ===========================
   GET handler (reusable)
   =========================== */
async function listOrders(req, res) {
  try {
    const user = req.user;
    const match = buildSmartMatch(user);

    const tasks = [];

    if (HotelBooking) {
      tasks.push(safe(async () => {
        const rows = await HotelBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('hotel', r)));
      }, 'hotel'));
    }
    if (ShortletBooking) {
      tasks.push(safe(async () => {
        const rows = await ShortletBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('shortlet', r)));
      }, 'shortlet'));
    }
    if (EventBooking) {
      tasks.push(safe(async () => {
        const rows = await EventBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('event', r)));
      }, 'event'));
    }
    if (RestaurantBooking) {
      tasks.push(safe(async () => {
        const rows = await RestaurantBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('restaurant', r)));
      }, 'restaurant'));
    }
    if (TourBooking) {
      tasks.push(safe(async () => {
        const rows = await TourBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('tour', r)));
      }, 'tour'));
    }
    if (ChopsBooking) {
      tasks.push(safe(async () => {
        const rows = await ChopsBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('chops', r)));
      }, 'chops'));
    }
    if (GiftBooking) {
      tasks.push(safe(async () => {
        const rows = await GiftBooking.find(match).sort({ createdAt: -1 }).lean();
        return Promise.all(rows.map(r => mapBookingToOrder('gifts', r)));
      }, 'gifts'));
    }

    const chunks = await Promise.all(tasks);
    let orders = chunks.flat();

    // Ledger fallback (protected)
    let ledgerRows = [];
    try {
      if (Ledger) {
        ledgerRows = await Ledger.find({
          accountType: 'user',
          accountId: user._id,
          direction: 'credit',
          reason: { $in: ['user_cashback', 'user_referral_commission'] },
        }).select('bookingId amount createdAt meta').lean();
      }
    } catch (e) {
      console.warn('[myOrders] ledger query failed:', e?.message || e);
      ledgerRows = [];
    }

    const ids = dedupe(ledgerRows.map(r => String(r.bookingId || '')).filter(Boolean));
    for (const bid of ids) {
      const found = await findBookingByIdAcross(bid);
      if (found) {
        const mapped = await mapBookingToOrder(found.category, found.doc);
        orders.push(mapped);
      } else {
        const l = ledgerRows.find(x => String(x.bookingId) === bid);
        orders.push({
          _id: bid,
          email: '',
          paymentReference: nn(l?.meta?.paymentReference),
          category: (l?.meta?.category || 'order').toString(),
          title: (l?.meta?.title || 'Order').toString(),
          subTitle: nn(l?.meta?.subTitle),
          amount: parseMoney(l?.amount),
          createdAt: l?.createdAt || new Date(),
          paymentStatus: 'paid',
          canceled: false,
        });
      }
    }

    // de-dupe and sort
    const seen = new Set();
    const deduped = [];
    for (const o of orders.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))) {
      const key = `${String(o._id)}::${o.category}`;
      if (!seen.has(key)) { seen.add(key); deduped.push(o); }
    }

    return res.json(deduped);
  } catch (err) {
    console.error('myOrdersRoutes /orders error:', err);
    return res.status(500).json({ message: 'Failed to fetch orders' });
  }
}

/* ===========================
   Routes
   =========================== */

// Old path (kept)
router.get('/orders',   auth, listOrders);

// New alias used by MyBookings.js
router.get('/bookings', auth, listOrders);

// ---------- POST /api/my/link-booking ----------
router.post('/link-booking', async (req, res) => {
  try {
    const referenceRaw = String(req.body?.reference || '').trim();
    let emailFromBody   = String(req.body?.email || '').trim().toLowerCase();
    if (!referenceRaw) return res.status(400).json({ message: 'Payment reference is required.' });

    // If authenticated, bind to the auth email
    let targetEmail = emailFromBody;
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id) {
          const u = await User.findById(decoded.id).lean();
          if (u?.email) targetEmail = String(u.email).toLowerCase();
        }
      }
    } catch {}

    if (!targetEmail) return res.status(400).json({ message: 'Email is required (or log in first).' });

    const found = await findBookingByReferenceAcross(referenceRaw);
    if (!found) return res.status(404).json({ message: 'No booking found for this reference.' });

    const { category, doc } = found;

    const previousEmail = String(doc.email || '');
    doc.email = targetEmail;
    await doc.save();

    const mapped = await mapBookingToOrder(category, doc.toObject ? doc.toObject() : doc);
    return res.json({
      message: previousEmail && previousEmail.toLowerCase() !== targetEmail
        ? 'Booking email updated and linked to your account.'
        : 'Booking linked to your account.',
      booking: mapped,
    });
  } catch (err) {
    console.error('link-booking error:', err);
    return res.status(500).json({ message: 'Failed to link booking.' });
  }
});

module.exports = router;

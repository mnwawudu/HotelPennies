// server.js — production-clean
// ---------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env from standard .env, then also from Render Secret File if present
dotenv.config(); // ./.env if present
const RENDER_ENV = '/etc/secrets/.env';
if (fs.existsSync(RENDER_ENV)) {
  dotenv.config({ path: RENDER_ENV, override: true });
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// --- Safe import for express-rate-limit (v6, v7, or missing) ---
let rateLimit;
try {
  const erl = require('express-rate-limit');
  rateLimit = erl?.rateLimit || erl; // v7={ rateLimit }, v6=fn
  if (typeof rateLimit !== 'function') throw new Error('export shape unexpected');
  console.log('✅ express-rate-limit loaded');
} catch (e) {
  console.warn('⚠️ express-rate-limit not available; using a no-op limiter:', e?.message || e);
  rateLimit = () => (req, res, next) => next();
}

const configService = require('./services/configService');

// Polyfill fetch for Node < 18
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  require('./polyfills/fetch');
}

const app = express();
app.disable('x-powered-by');

// --- Webhook (raw body) BEFORE JSON body parsing ---
const paystackWebhook = require('./routes/paystackWebhook');
app.use('/api/webhooks/paystack', express.raw({ type: '*/*' }), paystackWebhook);

/* ============================================================
   CORS (env allow-list + sensible defaults)  ✅ UPDATED BLOCK
   ============================================================ */
const defaultOrigins = [
  'http://localhost:3000',
  'https://hotelpennies.com',
  'https://www.hotelpennies.com',
  'https://hotelpennies-frontend.onrender.com',
  'https://hotelpennies-4.onrender.com', // backend on Render
];

const envOrigins = (process.env.ORIGIN_WHITELIST || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

const isLocalDevOrigin = (o) =>
  !!o && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(o) || o === 'capacitor://localhost');

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.has(origin) || isLocalDevOrigin(origin)) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    // Best practice: include all verbs you use today + OPTIONS
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Best practice: allow the headers you actually send (Auth + JSON)
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.options('*', cors());


// --- Trust proxy + security/compression/limits ---
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());

// Use safe limiter (no-op if not installed)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api', apiLimiter);

// --- Body parsers (after webhook raw) ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MongoDB + config prime ---
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await configService.prime();
      console.log('✅ Config cache primed');
    } catch (e) {
      console.warn('⚠️ Config cache prime skipped:', e?.message || e);
    }
  })
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// --- Route imports ---
const authRoutes = require('./routes/authRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const vendorProfileUpdateRoutes = require('./routes/vendorProfileUpdate');
const shortletRoutes = require('./routes/shortletRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const restaurantMenuRoutes = require('./routes/restaurantMenuRoutes');
const eventCenterRoutes = require('./routes/eventCenterRoutes');
const tourGuideRoutes = require('./routes/tourGuideRoutes');
const tourGuideBookingRoutes = require('./routes/tourGuideBookingRoutes');
const advertRoutes = require('./routes/advertRoutes');
const registerRoutes = require('./routes/register');
const loginRoutes = require('./routes/login');
const userRegisterRoutes = require('./routes/userRegister');
const userDashboardRoutes = require('./routes/userDashboard');
const adminPayoutRoutes = require('./routes/adminPayoutRoutes');
const verifyEmailRoutes = require('./routes/verifyEmail');
const vendorDashboardRoutes = require('./routes/vendorDashboard');
const deleteUserRoute = require('./routes/deleteUser');
const verifyStatusRoutes = require('./routes/verifyStatus');
const featurePricingRoutes = require('./routes/featurePricingRoutes');
const featureListingRoutes = require('./routes/featureListingRoutes');
const pickupDeliveryRoutes = require('./routes/pickupDeliveryRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const cloudinaryRoutes = require('./routes/cloudinaryRoutes');
const hotelRoomRoutes = require('./routes/hotelRoomRoutes');
const vendorServiceRoutes = require('./routes/vendorServiceRoutes');
const chopRoutes = require('./routes/chopRoutes');
const chopsBookingRoutes = require('./routes/chopsBookingRoutes');
const giftRoutes = require('./routes/giftRoutes');
const cruiseRoutes = require('./routes/cruiseRoutes');
const cityCruisePriceRoutes = require('./routes/cityCruisePriceRoutes');
const blogRoutes = require('./routes/blogRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const hotelBookingRoutes = require('./routes/hotelBookingRoutes');
const shortletBookingRoutes = require('./routes/shortletBookingRoutes');
const paystackRoutes = require('./routes/paystackRoutes');
const restaurantBookingRoutes = require('./routes/restaurantBookingRoutes');
const eventCenterBookingRoutes = require('./routes/eventCenterBookingRoutes');
const publicFeaturedRoutes = require('./routes/publicFeaturedRoutes');
const searchRoutes = require('./routes/searchRoutes');
const cruiseInquiryRoutes = require('./routes/cruiseInquiryRoutes');
const payoutRequestRoutes = require('./routes/payoutRequestRoutes');
const bookingCancelRoutes = require('./routes/bookingCancelRoutes');
const authPasswordRoutes = require('./routes/authPasswordRoutes');
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const contentWriteGate = require('./middleware/contentWriteGate');
const adminUsersRoutes = require('./routes/adminUsers');

const myOrdersRoutes = require('./routes/myOrdersRoutes');
const adminAuditRoutes = require('./routes/adminAuditRoutes');
const adminLedgerRoutes = require('./routes/adminLedgerRoutes');
const guestCancelRoutes = require('./routes/guestCancelRoutes');
const adminFeatureRoutes = require('./routes/adminFeatureRoutes');
const adminVendorApprovalRoutes = require('./routes/adminVendorApprovalRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const hotelPublicTopRoutes = require('./routes/hotelPublicTopRoutes');
const vendorAgreementRoutes = require('./routes/vendorAgreement');
const adminVendorAgreementRoutes = require('./routes/adminVendorAgreement');


// --- Route mounts ---
app.use('/api/payments', paymentRoutes);
app.use('/api', authRoutes);
app.use('/api/vendor', vendorProfileUpdateRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/restaurant-menus', restaurantMenuRoutes);
app.use('/api/eventcenters', eventCenterRoutes);
app.use('/api/tour-guides', tourGuideRoutes);
app.use('/api/tour-guides/tour-guide-bookings', tourGuideBookingRoutes);
app.use('/api/adverts', advertRoutes);
app.use('/api', registerRoutes);
app.use('/api', loginRoutes);
app.use('/api/user', verifyEmailRoutes);
app.use('/api/user', userRegisterRoutes);
app.use('/api/user', userDashboardRoutes);
app.use('/api/admin', adminPayoutRoutes);
app.use('/api/vendor', vendorDashboardRoutes);
app.use('/api/user', deleteUserRoute);
app.use('/api', verifyStatusRoutes);
app.use('/api/feature-pricing', featurePricingRoutes);
app.use('/api/featurelisting', featureListingRoutes);
app.use('/api/pickup-delivery', pickupDeliveryRoutes);
app.use('/api/admin', adminAuthRoutes);
app.use('/api/admin', adminDashboardRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/hotel-rooms', hotelRoomRoutes);
app.use('/api/vendor', vendorServiceRoutes);
app.use('/api/chops', chopRoutes);
app.use('/api/chops', chopsBookingRoutes);
app.use('/api/gifts', giftRoutes);
app.use('/api/cruises', cruiseRoutes);
app.use('/api/citycruise-prices', cityCruisePriceRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/bookings/hotel', hotelBookingRoutes);
app.use('/api/shortlet-bookings', shortletBookingRoutes);
app.use('/api/paystack', paystackRoutes);
app.use('/api/restaurant-bookings', restaurantBookingRoutes);

// Your original event center mount
app.use('/api/eventcenters/bookings', eventCenterBookingRoutes);
// ✅ Optional alias to match FE variants like "/api/event-center-bookings"
app.use('/api/event-center-bookings', eventCenterBookingRoutes);

app.use('/api/featured', publicFeaturedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cruise-inquiries', cruiseInquiryRoutes);
app.use('/api/payouts', payoutRequestRoutes);

// ✅ DEBUG shim to confirm routing (remove later)
app.use(['/api/bookings/guest', '/api/guest'], (req, _res, next) => {
  console.log(`[router-watch] ${req.method} ${req.originalUrl}`);
  next();
});

// ✅ Mount guest cancel routes BEFORE the generic /api/bookings router
app.use('/api/guest', guestCancelRoutes);              // alias that cannot be shadowed
app.use('/api/bookings/guest', guestCancelRoutes);     // legacy/FE path

// Generic bookings router (cancel, refund-preview, etc.)
app.use('/api/bookings', bookingCancelRoutes);

app.use('/api/my', myOrdersRoutes);
app.use('/api/user', myOrdersRoutes);
app.use('/api/admin', adminAuditRoutes);
app.use('/api/admin/ledger', adminLedgerRoutes);
app.use('/api/auth', authPasswordRoutes);
app.use('/api/admin/features', adminFeatureRoutes);
app.use('/api/admin', adminVendorApprovalRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api', hotelPublicTopRoutes);
app.use('/api', vendorAgreementRoutes);
app.use('/api/admin', adminVendorAgreementRoutes);
app.use(contentWriteGate());
app.use('/api/admin', adminUsersRoutes);


// --- Health & API 404 ---
app.get('/api/test', (_req, res) => {
  res.send('✅ HotelPennies API is running and reachable');
});

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ message: 'Route not found' }));

// --- Static uploads ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d', immutable: true }));

// --- Root ping ---
app.get('/', (_req, res) => res.send('HotelPennies API is running...'));

// --- SPA fallback (only if serving FE from this service) ---
const clientBuildPath = path.join(__dirname, 'client', 'build');
if (process.env.SERVE_SPA === 'true' && fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (_req, res) => res.sendFile(path.join(clientBuildPath, 'index.html')));
}

/* ============================
   SINGLE global error handler
   (leave this LAST)
   ============================ */
app.use((err, req, res, _next) => {
  const status = err?.status || err?.statusCode || 500;
  const payload = {
    ok: false,
    error: {
      name: err?.name || 'Error',
      message: err?.message || 'Internal server error',
      code: err?.code || null,
    },
  };

  // Loud server-side log so Render shows the real cause
  console.error('[ERROR]', {
    method: req.method,
    url: req.originalUrl,
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
      origin: req.headers['origin'],
      referer: req.headers['referer'],
    },
    body: req.body,
    user: req.user || req.vendor || null,
    name: err?.name,
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });

  res.status(status).json(payload);
});

// --- Graceful shutdown ---
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));

// --- Start server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

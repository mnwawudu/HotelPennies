// server.js — production-ready with hardening + require diagnostics
// ---------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

// Helper: require with explicit diagnostics (which file failed)
const R = (p) => {
  try {
    const m = require(p);
    console.log('✅ required:', p);
    return m;
  } catch (e) {
    console.error('❌ require failed:', p);
    console.error(e && e.stack ? e.stack : e);
    // Fail fast with non-zero exit so Render logs show the culprit
    process.exit(1);
  }
};

// Optional startup checks (enable via RENDER_DEBUG=1)
if (process.env.RENDER_DEBUG) {
  const reqs = [
    'adminAnalyticsRoutes','adminAuditRoutes','adminAuthRoutes','adminDashboardRoutes',
    'adminFeatureRoutes','adminLedgerRoutes','adminPayoutRoutes','adminSettingsRoutes',
    'adminUserRoutes','adminVendorApprovalRoutes','advertRoutes','authPasswordRoutes',
    'authRoutes','blogRoutes','bookingCancelRoutes','chopRoutes','chopsBookingRoutes',
    'cityCruisePriceRoutes','cloudinaryRoutes','cruiseInquiryRoutes','cruiseRoutes',
    'deleteUser','eventCenterBookingRoutes','eventCenterRoutes','featureListingRoutes',
    'featurePricingRoutes','giftRoutes','guestCancelRoutes','hotelBookingRoutes',
    'hotelPublicTopRoutes','hotelRoomRoutes','hotelRoutes','login','myOrdersRoutes',
    'paymentRoutes','payoutRequestRoutes','paystackRoutes','pickupDeliveryRoutes',
    'publicFeaturedRoutes','register','restaurantBookingRoutes','restaurantMenuRoutes',
    'restaurantRoutes','reviewRoutes','searchRoutes','shortletBookingRoutes','shortletRoutes',
    'tourGuideBookingRoutes','tourGuideRoutes','userDashboard','userRegister',
    'vendorDashboard','vendorProfileUpdate','vendorServiceRoutes','verifyEmail','verifyStatus'
  ];
  for (const r of reqs) {
    const p = path.join(__dirname, 'routes', `${r}.js`);
    console.log('🔎 Route check:', p, 'exists?', fs.existsSync(p));
  }
}

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

// Use safe require for local modules too (catches case/paths)
const configService = R('./services/configService');

// Polyfill fetch for Node < 18
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  R('./polyfills/fetch');
}

const app = express();
app.disable('x-powered-by');

// --- Webhook (raw body) BEFORE JSON body parsing ---
const webhookAbsPath = path.join(__dirname, 'routes', 'paystackWebhook.js');
console.log('🔎 Checking webhook file:', webhookAbsPath, 'exists?', fs.existsSync(webhookAbsPath));
const paystackWebhook = R(webhookAbsPath); // absolute path with .js
app.use('/api/webhooks/paystack', express.raw({ type: '*/*' }), paystackWebhook);

// --- CORS (env allow-list + sensible defaults) ---
const defaultOrigins = [
  'http://localhost:3000',
  'https://hotelpennies.com',
  'https://www.hotelpennies.com',
  'https://hotelpennies-frontend.onrender.com',
  // backend URL is harmless to allow from browsers:
  'https://hotelpennies-4.onrender.com',
];

const envOrigins = (process.env.ORIGIN_WHITELIST || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Postman/cURL/native apps
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error('CORS blocked'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.options('*', cors());

// --- Trust proxy + security/compression/limits ---
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());

// Use safe limiter (no-op if not installed)
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
app.use('/api', apiLimiter);

// --- Body parsers (after webhook raw) ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MongoDB + config prime ---
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('✅ MongoDB connected');
  try {
    await configService.prime();
    console.log('✅ Config cache primed');
  } catch (e) {
    console.warn('⚠️ Config cache prime skipped:', e?.message || e);
  }
}).catch(err => console.error('❌ MongoDB connection error:', err));

// --- Route imports (ALL via R to surface any remaining case/path issues) ---
const authRoutes = R('./routes/authRoutes');
const paymentRoutes = R('./routes/paymentRoutes');
const vendorProfileUpdateRoutes = R('./routes/vendorProfileUpdate');
const shortletRoutes = R('./routes/shortletRoutes');
const hotelRoutes = R('./routes/hotelRoutes');
const restaurantRoutes = R('./routes/restaurantRoutes');
const restaurantMenuRoutes = R('./routes/restaurantMenuRoutes');
const eventCenterRoutes = R('./routes/eventCenterRoutes');
const tourGuideRoutes = R('./routes/tourGuideRoutes');
const tourGuideBookingRoutes = R('./routes/tourGuideBookingRoutes');
const advertRoutes = R('./routes/advertRoutes');
const registerRoutes = R('./routes/register');
const loginRoutes = R('./routes/login');
const userRegisterRoutes = R('./routes/userRegister');
const userDashboardRoutes = R('./routes/userDashboard');
const adminPayoutRoutes = R('./routes/adminPayoutRoutes');
const verifyEmailRoutes = R('./routes/verifyEmail');
const vendorDashboardRoutes = R('./routes/vendorDashboard');
const deleteUserRoute = R('./routes/deleteUser');
const verifyStatusRoutes = R('./routes/verifyStatus');
const featurePricingRoutes = R('./routes/featurePricingRoutes');
const featureListingRoutes = R('./routes/featureListingRoutes');
const pickupDeliveryRoutes = R('./routes/pickupDeliveryRoutes');
const adminAuthRoutes = R('./routes/adminAuthRoutes');
const adminDashboardRoutes = R('./routes/adminDashboardRoutes');
const cloudinaryRoutes = R('./routes/cloudinaryRoutes');
const hotelRoomRoutes = R('./routes/hotelRoomRoutes');
const vendorServiceRoutes = R('./routes/vendorServiceRoutes');
const chopRoutes = R('./routes/chopRoutes');
const chopsBookingRoutes = R('./routes/chopsBookingRoutes');
const giftRoutes = R('./routes/giftRoutes');
const cruiseRoutes = R('./routes/cruiseRoutes');
const cityCruisePriceRoutes = R('./routes/cityCruisePriceRoutes');
const blogRoutes = R('./routes/blogRoutes');
const reviewRoutes = R('./routes/reviewRoutes');
const hotelBookingRoutes = R('./routes/hotelBookingRoutes');
const shortletBookingRoutes = R('./routes/shortletBookingRoutes');
const paystackRoutes = R('./routes/paystackRoutes');
const restaurantBookingRoutes = R('./routes/restaurantBookingRoutes');
const eventCenterBookingRoutes = R('./routes/eventCenterBookingRoutes');
const publicFeaturedRoutes = R('./routes/publicFeaturedRoutes');
const searchRoutes = R('./routes/searchRoutes');
const cruiseInquiryRoutes = R('./routes/cruiseInquiryRoutes');
const payoutRequestRoutes = R('./routes/payoutRequestRoutes');
const bookingCancelRoutes = R('./routes/bookingCancelRoutes');
const authPasswordRoutes = R('./routes/authPasswordRoutes');
const adminSettingsRoutes = R('./routes/adminSettingsRoutes');

const myOrdersRoutes = R('./routes/myOrdersRoutes');
const adminAuditRoutes = R('./routes/adminAuditRoutes');
const adminLedgerRoutes = R('./routes/adminLedgerRoutes');
const guestCancelRoutes = R('./routes/guestCancelRoutes');
const adminFeatureRoutes = R('./routes/adminFeatureRoutes');
const adminVendorApprovalRoutes = R('./routes/adminVendorApprovalRoutes');
const adminUserRoutes = R('./routes/adminUserRoutes');
const adminAnalyticsRoutes = R('./routes/adminAnalyticsRoutes');
const hotelPublicTopRoutes = R('./routes/hotelPublicTopRoutes');

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
app.use('/api/eventcenters/bookings', eventCenterBookingRoutes);
app.use('/api/featured', publicFeaturedRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cruise-inquiries', cruiseInquiryRoutes);
app.use('/api/payouts', payoutRequestRoutes);
app.use('/api/bookings', bookingCancelRoutes);
app.use('/api/my', myOrdersRoutes);
app.use('/api/admin', adminAuditRoutes);
app.use('/api/admin/ledger', adminLedgerRoutes);
app.use('/api/bookings/guest', guestCancelRoutes);
app.use('/api/auth', authPasswordRoutes);
app.use('/api/admin/features', adminFeatureRoutes);
app.use('/api/admin', adminVendorApprovalRoutes);
app.use('/api/admin', adminUserRoutes);
app.use('/api/admin', adminAnalyticsRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api', hotelPublicTopRoutes);

// --- Health & API 404 ---
app.get('/api/test', (req, res) => {
  res.send('✅ HotelPennies API is running and reachable');
});

app.use('/api', (req, res) => {
  return res.status(404).json({ message: 'Route not found' });
});

// --- Static uploads ---
app.use('/uploads', express.static(
  path.join(__dirname, 'uploads'),
  { maxAge: '7d', immutable: true }
));

// --- Root ping ---
app.get('/', (req, res) => {
  res.send('HotelPennies API is running...');
});

// --- Global error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// --- Graceful shutdown + extra logging ---
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// --- SPA fallback (only if serving FE from this service) ---
const clientBuildPath = path.join(__dirname, 'client', 'build');
if (process.env.SERVE_SPA === 'true' && fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// --- Start server ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

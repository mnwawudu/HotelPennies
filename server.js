// server.js — production-ready 
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const configService = require('./services/configService');

// Polyfill fetch for Node < 18
const major = parseInt(process.versions.node.split('.')[0], 10);
if (major < 18) {
  require('./polyfills/fetch');
}

const app = express();
app.disable('x-powered-by');

// --- Webhook (raw body) BEFORE JSON body parsing ---
app.use(
  '/api/webhooks/paystack',
  express.raw({ type: '*/*' }),
  require('./routes/paystackWebhook')
);

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

// Additional route files
const myOrdersRoutes = require('./routes/myOrdersRoutes');
const adminAuditRoutes = require('./routes/adminAuditRoutes');
const adminLedgerRoutes = require('./routes/adminLedgerRoutes');
const guestCancelRoutes = require('./routes/guestCancelRoutes');
const adminFeatureRoutes = require('./routes/adminFeatureRoutes');
const adminVendorApprovalRoutes = require('./routes/adminVendorApprovalRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalyticsRoutes');
const hotelPublicTopRoutes = require('./routes/hotelPublicTopRoutes');

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

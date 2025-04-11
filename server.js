// ✅ Route imports
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const shortletRoutes = require('./shortletRoutes');
const advertRoutes = require('./advertRoutes');
const bookingRoutes = require('./bookingRoutes');
const paymentRoutes = require('./paymentRoutes');
const payoutRoutes = require('./payoutRoutes'); // ✅ Added this

// ✅ Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/adverts', advertRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payouts', payoutRoutes); // ✅ Added this

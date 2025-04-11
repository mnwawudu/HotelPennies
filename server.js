const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

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

// ✅ Root test route
app.get('/', (req, res) => {
  res.send('🚀 HotelPennies backend is live!');
});

// ✅ Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

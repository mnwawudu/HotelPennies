const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Route files
const userRoutes = require('./userRoutes');
const dashboardRoutes = require('./dashboardRoute');
const payoutRoutes = require('./payoutRoutes');
const bookingRoutes = require('./bookingRoutes'); // ✅ Booking route added

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Route registrations
app.use('/api/users', userRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/bookings', bookingRoutes); // ✅ Register booking route

app.get('/', (req, res) => {
  res.send('HotelPennies API is running...');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

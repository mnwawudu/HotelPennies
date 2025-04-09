const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const userRoutes = require('./userRoutes');
const shortletRoutes = require('./shortletRoutes');
const bookingRoutes = require('./bookingRoutes');
const eventCenterRoutes = require('./eventCenterRoutes'); // ✅ NEW

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/event-centers', eventCenterRoutes); // ✅ NEW

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

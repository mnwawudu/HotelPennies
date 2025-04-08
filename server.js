const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Import routes
const userRoutes = require('./routes/userRoutes');
const shortletRoutes = require('./routes/shortletRoutes');
const eventCenterRoutes = require('./routes/eventCenterRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

// Use routes
app.use('/api/user', userRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/event-centers', eventCenterRoutes);
app.use('/api/bookings', bookingRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

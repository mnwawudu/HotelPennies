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

// Route imports
const userRoutes = require('./userRoutes');
const shortletRoutes = require('./routes/shortletRoutes');
const eventCenterRoutes = require('./routes/eventCenterRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

// Route usage
app.use('/api/user', userRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/event-centers', eventCenterRoutes);
app.use('/api/bookings', bookingRoutes);

// Start server
app.listen(5000, () => console.log('Server running on port 5000'));

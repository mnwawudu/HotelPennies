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

// Routes
const userRoutes = require('./userRoutes');
const shortletRoutes = require('./shortletRoutes');
const advertRoutes = require('./advertRoutes');
const bookingRoutes = require('./bookingRoutes'); // ✅ NEW: for booking with ride option

// Use Routes
app.use('/api/users', userRoutes);
app.use('/api/shortlets', shortletRoutes);
app.use('/api/adverts', advertRoutes);
app.use('/api/bookings', bookingRoutes); // ✅ New booking endpoint

// Start Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes'); // Example route import
// Add your other route imports here

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

// Routes
app.use('/api/users', userRoutes);
// Add other route uses here, like:
// app.use('/api/bookings', bookingRoutes);

// Root route (this is what was missing)
app.get('/', (req, res) => {
  console.log('Root route hit');
  res.send('Backend is working!');
});

// Server start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

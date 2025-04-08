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
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'));

// Use routes from routes/userRoutes.js
const userRoutes = require('./routes/userRoutes');
app.use('/api/user', userRoutes);

// Start the server
app.listen(5000, () => console.log('Server running on port 5000'));

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'));

const userRoutes = require('./routes/user');
app.use('/api/user', userRoutes);

app.listen(5000, () => console.log('Server running on port 5000'));
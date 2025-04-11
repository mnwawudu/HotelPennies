const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const userRoutes = require('./userRoutes');
const dashboardRoute = require('./dashboardRoute'); // ✅ Add dashboard route

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB connected');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoute); // ✅ Register dashboard route

app.get('/', (req, res) => {
  res.send('HotelPennies API is running...');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

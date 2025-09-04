// seedCityCruisePrices.js
const mongoose = require('mongoose');
require('dotenv').config();
const CityCruisePrice = require('./models/cityCruisePriceModel');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    await CityCruisePrice.deleteMany({});
    console.log('🗑️ Deleted old cruise prices');

    const prices = [
      { duration: '1hr', price: 30000 },
      { duration: '3hrs', price: 90000 },
      { duration: '6hrs', price: 160000 },
      { duration: '12hrs', price: 250000 },
      { duration: '1 day', price: 300000 },
    ];

    await CityCruisePrice.insertMany(prices);
    console.log('✅ Inserted new city cruise prices');

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Seeding error:', err);
    mongoose.connection.close();
  }
};

seed();

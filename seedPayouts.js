// seedPayouts.js
require('dotenv').config();
const mongoose = require('mongoose');
const Payout = require('./models/payoutModel');

const MONGO_URI = process.env.MONGO_URI;

const seedPayouts = async () => {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Replace with a real user ID from your DB
    const userId = 'PUT_USER_ID_HERE';

    const dummyPayouts = [
      {
        user: userId,
        amount: 5000,
        status: 'paid',
        method: 'bank',
        reference: 'ref123',
      },
      {
        user: userId,
        amount: 3000,
        status: 'pending',
        method: 'wallet',
        reference: 'ref456',
      },
    ];

    await Payout.insertMany(dummyPayouts);
    console.log('🌱 Dummy payouts seeded successfully');
    process.exit();
  } catch (error) {
    console.error('❌ Error seeding payouts:', error);
    process.exit(1);
  }
};

seedPayouts();

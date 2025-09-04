// ✅ seedAdmin.js
const mongoose = require('mongoose');
const Admin = require('./models/adminModel');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existing = await Admin.findOne({ email: 'admin@example.com' });
    if (existing) {
      console.log('Admin already exists.');
      return process.exit();
    }

    const newAdmin = new Admin({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123', // plain password – model will hash it
    });

    await newAdmin.save();
    console.log('✅ Admin seeded: admin@example.com / admin123');
    process.exit();
  } catch (err) {
    console.error('❌ Seeding error:', err);
    process.exit(1);
  }
};

seedAdmin();

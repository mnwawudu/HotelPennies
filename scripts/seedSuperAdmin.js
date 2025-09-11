// scripts/seedSuperAdmin.js
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/adminModel');

(async () => {
  try {
    const email = (process.argv[2] || process.env.ADMIN_SEED_EMAIL || '').toLowerCase().trim();
    const password = process.argv[3] || process.env.ADMIN_SEED_PASSWORD;
    const username = process.argv[4] || 'Super Admin';

    if (!email || !password) {
      console.error('Usage: node scripts/seedSuperAdmin.js <email> <password> [username]');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    let admin = await Admin.findOne({ email }).select('+password');
    if (!admin) {
      admin = new Admin({ email, username, role: 'superadmin', password });
      await admin.save();
      console.log(`✅ Created superadmin ${email}`);
    } else {
      admin.role = 'superadmin';
      admin.password = password; // will be hashed
      await admin.save();
      console.log(`✅ Updated ${email} to superadmin and reset password`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('Seed error:', e);
    process.exit(1);
  }
})();

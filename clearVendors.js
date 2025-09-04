const mongoose = require('mongoose');
const Vendor = require('./models/vendorModel');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  const result = await Vendor.deleteMany({});
  console.log(`🧹 All vendors deleted: ${result.deletedCount}`);
  await mongoose.disconnect();
})
.catch(err => {
  console.error('❌ MongoDB error:', err);
});

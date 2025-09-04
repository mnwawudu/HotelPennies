const mongoose = require('mongoose');
const dotenv = require('dotenv');
const PickupDeliveryOption = require('./models/pickupDeliveryModel');

dotenv.config();

const seedData = [
  {
    type: 'delivery',
    businessType: 'chops',
    state: 'Imo',
    title: 'Chops Delivery in Imo',
    description: 'Standard delivery for chops in Imo state',
    price: 2000
  },
  {
    type: 'delivery',
    businessType: 'gifts',
    state: 'Imo',
    title: 'Gift Delivery in Imo',
    description: 'Standard gift delivery in Imo',
    price: 2500
  },
  {
    type: 'delivery',
    businessType: 'chops',
    state: 'Lagos',
    fromZone: 'Ikeja',
    toZone: 'Lekki',
    title: 'Chops Delivery Lagos',
    description: 'Zone-based delivery for Chops',
    price: 3000
  },
  {
    type: 'delivery',
    businessType: 'gifts',
    state: 'Lagos',
    fromZone: 'Surulere',
    toZone: 'Ajah',
    title: 'Gift Delivery Lagos',
    description: 'Zone-based delivery for Gifts',
    price: 3500
  }
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    await PickupDeliveryOption.insertMany(seedData);
    console.log('✅ Chops and Gifts delivery options seeded');
    process.exit();
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();

// patchMissingResourceIds.js
const mongoose = require('mongoose');
const FeatureListing = require('./models/featureListingModel');
require('dotenv').config();

const runFix = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const features = await FeatureListing.find({
      isPaid: true,
      $or: [{ resourceId: { $exists: false } }, { resourceId: null }],
      roomId: { $exists: true, $ne: null },
    });

    console.log(`🔧 Found ${features.length} features to fix`);

    for (const feature of features) {
      feature.resourceId = feature.roomId;
      await feature.save();
      console.log(`✅ Fixed feature ${feature._id}`);
    }

    console.log('🎉 All missing resourceIds patched!');
    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error fixing resourceIds:', err);
    process.exit(1);
  }
};

runFix();

const cron = require('node-cron');
const Advert = require('../models/advertModel');  // Import the Advert model

// Run every day at midnight (00:00)
cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date(); // Get the current date
    const expiredAds = await Advert.find({
      expiryDate: { $lte: now },  // Check if the expiry date has passed
      isActive: true               // Ensure the ad is still active
    });

    // Loop through each expired ad and update the status
    expiredAds.forEach(async (advert) => {
      // Mark the ad as inactive and remove it from the featured section
      await Advert.findByIdAndUpdate(advert._id, { isActive: false, featured: false });
      console.log(`Ad ${advert._id} marked as inactive due to expiry.`);
    });

  } catch (err) {
    console.error('Error checking for expired ads:', err);
  }
});

// === Promote matured ledger credits to 'available' every 10 minutes ===
const mongoose = require('mongoose');
const Ledger = require('../models/ledgerModel');

cron.schedule('*/10 * * * *', async () => {
  try {
    const now = new Date();
    const res = await Ledger.updateMany(
      { status: 'pending', releaseOn: { $lte: now } },
      { $set: { status: 'available' } }
    );
    if (res.modifiedCount) {
      console.log(`[Ledger Maturation] Promoted ${res.modifiedCount} row(s) to 'available' at ${now.toISOString()}`);
    }
  } catch (err) {
    console.error('Ledger maturation error:', err);
  }
});

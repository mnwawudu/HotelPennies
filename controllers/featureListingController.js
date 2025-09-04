const FeatureListing = require('../models/featureListingModel');
const axios = require('axios');

// 🔹 Vendor creates feature request
exports.createFeatureRequest = async (req, res) => {
  try {
    const { roomId, featureType } = req.body;

    const newFeature = new FeatureListing({
      roomId,
      vendorId: req.vendorId,
      featureType,
      isPaid: false,
    });

    await newFeature.save();
    res.status(201).json({ message: 'Feature request submitted', feature: newFeature });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create feature request', error: err.message });
  }
};

// 🔹 Admin or vendor gets all feature listings
exports.getAllFeatureListings = async (req, res) => {
  try {
    const listings = await FeatureListing.find().populate('roomId vendorId');
    res.json(listings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch listings', error: err.message });
  }
};

// 🔹 Verify payment (Paystack)
exports.verifyFeaturePayment = async (req, res) => {
  const { reference } = req.body;

  try {
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const status = response.data.data.status;

    if (status === 'success') {
      res.status(200).json({ message: 'Payment verified successfully', data: response.data.data });
    } else {
      res.status(400).json({ message: 'Payment verification failed' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error verifying payment', error: err.message });
  }
};

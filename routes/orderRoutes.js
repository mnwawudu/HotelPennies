// ✅ routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const Order = require('../models/orderModel');
const auth = require('../middleware/adminAuth');

// @desc    Create new order (Chop, Gift, Cruise, etc.)
// @route   POST /api/orders
// @access  Public (Admin-controlled resources)
router.post('/', async (req, res) => {
  try {
    const {
      itemId,
      itemType,
      itemName,
      quantity,
      unitPrice,
      totalPrice,
      deliveryFee,
      finalPrice,
      buyerName,
      buyerPhone,
      buyerEmail,
      address,
      note,
    } = req.body;

    if (!itemId || !itemType || !itemName || !quantity || !unitPrice || !finalPrice) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const order = new Order({
      itemId,
      itemType,
      itemName,
      quantity,
      unitPrice,
      totalPrice,
      deliveryFee,
      finalPrice,
      buyerName,
      buyerPhone,
      buyerEmail,
      address,
      note,
    });

    await order.save();
    res.status(201).json({ message: '✅ Order placed successfully', order });
  } catch (error) {
    console.error('❌ Order creation failed:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @desc    Get all orders (Admin)
// @route   GET /api/orders
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('❌ Failed to fetch orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @desc    Get orders by item type
// @route   GET /api/orders/type/:itemType
// @access  Private (Admin only)
router.get('/type/:itemType', auth, async (req, res) => {
  try {
    const { itemType } = req.params;
    const orders = await Order.find({ itemType }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error('❌ Failed to fetch filtered orders:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;

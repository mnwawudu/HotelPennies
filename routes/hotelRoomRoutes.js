// ðŸ“ backend/routes/hotelRoomRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const Room = require('../models/roomModel');
const authMiddleware = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// âœ… Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// âœ… Multer setup
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only jpg, png, webp allowed'));
    }
    cb(null, true);
  }
});

// âœ… Test route
router.get('/test', (req, res) => {
  res.send('âœ… Hotel Room Routes Loaded');
});

// âœ… Create room
router.post('/create/:hotelId', authMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    const { name, price, guestCapacity, bedType, promoPrice, complimentary, description } = req.body;

    const uploads = await Promise.all(
      req.files.map(file => cloudinary.uploader.upload(file.path, { folder: 'HotelPennies' }))
    );
    const images = uploads.map(img => img.secure_url);
    req.files.forEach(file => fs.unlinkSync(file.path));

    const newRoom = new Room({
      name,
      price,
      guestCapacity,
      bedType,
      promoPrice,
      complimentary,
      description,
      images,
      hotelId: req.params.hotelId,
      vendorId: req.user._id
    });

    await newRoom.save();
    res.status(201).json({ message: 'Room created successfully', room: newRoom });
  } catch (err) {
    console.error('âŒ Room creation error:', err);
    res.status(500).json({ message: 'Room creation failed' });
  }
});

// âœ… Get all rooms for a hotel
router.get('/:hotelId/rooms', async (req, res) => {
  try {
    const hotelId = req.params.hotelId;
    if (!mongoose.Types.ObjectId.isValid(hotelId)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const rooms = await Room.find({ hotelId });
    res.json(rooms);
  } catch (err) {
    console.error('âŒ Fetch rooms error:', err);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

// âœ… Get public rooms
router.get('/public', async (req, res) => {
  try {
    const rooms = await Room.find().populate('hotelId', 'city');
    res.json(rooms);
  } catch (err) {
    console.error('âŒ Public room fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch public rooms' });
  }
});

// âœ… Get single room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch room' });
  }
});

// âœ… Upload images
router.post('/upload/:roomId', authMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    const uploadedImages = await Promise.all(
      req.files.map(file => cloudinary.uploader.upload(file.path, { folder: 'HotelPennies' }))
    );
    const imageUrls = uploadedImages.map(img => img.secure_url);

    room.images.push(...imageUrls);
    await room.save();

    req.files.forEach(file => fs.unlinkSync(file.path));
    res.json({ message: 'Uploaded successfully', images: room.images });
  } catch (err) {
    console.error('âŒ Upload error:', err);
    res.status(500).json({ message: 'Image upload failed' });
  }
});

// âœ… Set main image
router.put('/:roomId/main-image', authMiddleware, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.roomId,
      { mainImage: imageUrl },
      { new: true }
    );
    if (!room) return res.status(404).json({ message: 'Room not found' });

    res.json({ message: 'Main image set', room });
  } catch (err) {
    res.status(500).json({ message: 'Failed to set main image' });
  }
});

// âœ… Update room
router.put('/:roomId', authMiddleware, async (req, res) => {
  try {
    const updated = await Room.findOneAndUpdate(
      { _id: req.params.roomId, vendorId: req.user._id },
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Room not found or unauthorized' });

    res.json(updated);
  } catch (err) {
    console.error('âŒ Update error:', err);
    res.status(500).json({ message: 'Failed to update room' });
  }
});

// âœ… Delete room
router.delete('/:roomId', authMiddleware, async (req, res) => {
  try {
    const deleted = await Room.findOneAndDelete({ _id: req.params.roomId, vendorId: req.user._id });
    if (!deleted) return res.status(404).json({ message: 'Room not found or unauthorized' });

    res.json({ message: 'Room deleted successfully' });
  } catch (err) {
    console.error('âŒ Delete error:', err);
    res.status(500).json({ message: 'Failed to delete room' });
  }
});

// âœ… GET room unavailable dates (frontend datepicker uses this)
router.get('/:roomId/unavailable-dates', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    res.json({ unavailableDates: room.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Fetch error:', err);
    res.status(500).json({ message: 'Failed to get unavailable dates' });
  }
});

// âœ… VENDOR: Save unavailable dates (only vendor can set these)
router.put('/:roomId/unavailable-dates', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findOne({ _id: req.params.roomId, vendorId: req.user._id });
    if (!room) return res.status(404).json({ message: 'Room not found or unauthorized' });

    room.unavailableDates = req.body.unavailableDates || [];
    await room.save();

    res.json({ message: 'Unavailable dates updated', unavailableDates: room.unavailableDates });
  } catch (err) {
    console.error('âŒ Error updating unavailable dates:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Feature toggle
router.put('/:roomId/feature', authMiddleware, async (req, res) => {
  try {
    const { isFeatured } = req.body;
    const updatedRoom = await Room.findOneAndUpdate(
      { _id: req.params.roomId, vendorId: req.user._id },
      { isFeatured },
      { new: true }
    );
    if (!updatedRoom) return res.status(404).json({ message: 'Room not found or unauthorized' });

    res.json({ message: 'Feature status updated', room: updatedRoom });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update feature status' });
  }
});

module.exports = router;


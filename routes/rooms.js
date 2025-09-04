const express = require('express');
const router = express.Router();
const Room = require('../models/roomModel');  // Assuming you have a Room model

// Get all rooms for a specific hotel
router.get('/:hotelId', async (req, res) => {
  try {
    const rooms = await Room.find({ hotelId: req.params.hotelId });  // Find rooms for the specific hotel
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch rooms' });
  }
});

// Delete a room
router.delete('/:roomId', async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.roomId);  // Delete room by ID
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json({ message: 'Room deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to delete room' });
  }
});

// Update blocked dates for a room
router.put('/:roomId/block-dates', async (req, res) => {
  try {
    const { blockedDates } = req.body;  // Assume blockedDates is an array of Date objects
    const room = await Room.findByIdAndUpdate(
      req.params.roomId,
      { blockedDates },  // Update the blocked dates
      { new: true }
    );
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }
    res.json(room);  // Return the updated room
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update blocked dates' });
  }
});
// ✅ Get unavailable dates for a room
router.get('/:roomId/unavailable-dates', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ message: 'Room not found' });

    res.json(room.unavailableDates || []);
  } catch (error) {
    console.error('❌ Failed to fetch unavailable dates:', error);
    res.status(500).json({ message: 'Failed to fetch unavailable dates' });
  }
});


module.exports = router;

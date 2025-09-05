const express = require('express');
const router = express.Router();
const User = require('../models/userModel');
const auth = require('../middleware/auth');

router.delete('/delete', auth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;


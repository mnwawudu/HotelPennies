const express = require('express');
const router = express.Router();

// Dummy endpoint to test
router.get('/test', (req, res) => {
  res.json({ message: 'User route is working!' });
});

module.exports = router;

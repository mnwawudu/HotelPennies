const express = require('express');
const router = express.Router();

// Dummy shortlet route for testing
router.get('/', (req, res) => {
  res.json({ message: 'Shortlet route is working at root level!' });
});

module.exports = router;

const express = require('express');
const router = express.Router();

// Example route to test
router.get('/', (req, res) => {
  res.send('Event Center routes are working!');
});

module.exports = router;

const express = require('express');
const router = express.Router();

// ✅ Simple test route to confirm everything works
router.get('/', (req, res) => {
  res.send('User route is working!');
});

module.exports = router;

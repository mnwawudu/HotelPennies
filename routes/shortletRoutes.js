const express = require('express');
const router = express.Router();

const shortlets = [];

router.post('/', (req, res) => {
  const shortlet = req.body;
  shortlets.push(shortlet);
  res.status(201).json(shortlet);
});

router.get('/', (req, res) => {
  res.json(shortlets);
});

module.exports = router;

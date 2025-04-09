const express = require('express');
const router = express.Router();
const Advert = require('./advertModel');

// Create new advert
router.post('/', async (req, res) => {
  const { title, imageUrl, link } = req.body;
  const newAdvert = new Advert({ title, imageUrl, link });
  await newAdvert.save();
  res.json({ message: 'Advert created', advert: newAdvert });
});

// Get all adverts
router.get('/', async (req, res) => {
  const adverts = await Advert.find().sort({ createdAt: -1 });
  res.json(adverts);
});

// Delete advert
router.delete('/:id', async (req, res) => {
  await Advert.findByIdAndDelete(req.params.id);
  res.json({ message: 'Advert deleted' });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const Advert = require('./advertModel'); // Make sure this path is correct

// Create a new advert
router.post('/create', async (req, res) => {
  try {
    const { title, description, imageUrl, link } = req.body;

    if (!title || !description || !imageUrl || !link) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const newAdvert = new Advert({ title, description, imageUrl, link });
    await newAdvert.save();

    res.status(201).json({ message: 'Advert created', advert: newAdvert });
  } catch (err) {
    console.error('Advert creation error:', err);
    res.status(500).json({ message: 'Failed to create advert', error: err.message });
  }
});

// Get all adverts
router.get('/', async (req, res) => {
  try {
    const adverts = await Advert.find().sort({ createdAt: -1 });
    res.json(adverts);
  } catch (err) {
    console.error('Error fetching adverts:', err);
    res.status(500).json({ message: 'Failed to fetch adverts', error: err.message });
  }
});

module.exports = router;

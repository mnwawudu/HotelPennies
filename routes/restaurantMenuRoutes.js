// ðŸ“ routes/restaurantMenuRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/upload'); // âœ… use existing working upload.js
const RestaurantMenu = require('../models/restaurantMenuModel');

// âœ… Upload new menu item with images
router.post('/upload/:restaurantId', auth, upload.array('images'), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { title, description, price, promoPrice, complimentary, available } = req.body;

    const imageUrls = req.files.map(file => file.path);

    const newMenu = new RestaurantMenu({
      restaurantId,
      title,
      description,
      price,
      promoPrice,
      complimentary,
      available,
      images: imageUrls,
      mainImage: imageUrls[0]
    });

    const savedMenu = await newMenu.save();
    res.status(201).json(savedMenu);
  } catch (err) {
    console.error('âŒ Menu upload error:', err);
    res.status(500).json({ message: 'Failed to upload menu item' });
  }
});

// âœ… Get all menu items by restaurant ID
router.get('/restaurant/:restaurantId', async (req, res) => {
  try {
    const menus = await RestaurantMenu.find({ restaurantId: req.params.restaurantId });
    res.json(menus);
  } catch (err) {
    console.error('âŒ Error fetching menu items:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Get single menu item by ID (for image modal fetch)
router.get('/:id', auth, async (req, res) => {
  try {
    const menu = await RestaurantMenu.findById(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu item not found' });
    res.json(menu);
  } catch (err) {
    console.error('âŒ Error fetching menu item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Push images or update mainImage
router.put('/:id', auth, async (req, res) => {
  try {
    const updateOps = {};
    if (req.body.$push) updateOps.$push = req.body.$push;
    if (req.body.$pull) updateOps.$pull = req.body.$pull;
    if (req.body.mainImage) updateOps.mainImage = req.body.mainImage;

    const updated = await RestaurantMenu.findByIdAndUpdate(
      req.params.id,
      updateOps,
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Menu not found' });
    res.json(updated);
  } catch (err) {
    console.error('âŒ Error updating menu item:', err);
    res.status(500).json({ message: 'Failed to update menu item' });
  }
});

// âœ… Set mainImage explicitly
router.put('/:id/main-image', auth, async (req, res) => {
  try {
    const { mainImage } = req.body;
    const menu = await RestaurantMenu.findByIdAndUpdate(
      req.params.id,
      { mainImage },
      { new: true }
    );
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    res.json(menu);
  } catch (err) {
    console.error('âŒ Failed to set main image:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:id/update', auth, async (req, res) => {
  try {
    const { title, price, promoPrice, complimentary, description, available } = req.body;

    const updated = await RestaurantMenu.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          title,
          price,
          promoPrice,
          complimentary,
          description,
          available
        }
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Menu item not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error('âŒ Failed to update menu item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Get unavailable dates for a menu item
router.get('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    const menu = await RestaurantMenu.findById(req.params.id);
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    res.json({ unavailableDates: menu.unavailableDates || [] });
  } catch (err) {
    console.error('âŒ Failed to fetch unavailable dates:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Update unavailable dates for a menu item
router.put('/:id/unavailable-dates', auth, async (req, res) => {
  try {
    const { unavailableDates } = req.body;
    const updated = await RestaurantMenu.findByIdAndUpdate(
      req.params.id,
      { unavailableDates },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: 'Menu not found' });
    res.json(updated);
  } catch (err) {
    console.error('âŒ Failed to update unavailable dates:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Delete menu item by ID
router.delete('/:id', auth, async (req, res) => {
  try {
    const deleted = await RestaurantMenu.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Menu not found' });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    console.error('âŒ Failed to delete menu item:', err);
    res.status(500).json({ message: 'Server error' });
  }
});




// âœ… Delete image from images array
router.put('/:id/delete-image', auth, async (req, res) => {
  try {
    const { url } = req.body;
    const menu = await RestaurantMenu.findByIdAndUpdate(
      req.params.id,
      { $pull: { images: url } },
      { new: true }
    );
    if (!menu) return res.status(404).json({ message: 'Menu not found' });
    res.json(menu);
  } catch (err) {
    console.error('âŒ Failed to delete image:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// âœ… Public: Fetch menus by restaurant ID (used in RestaurantDetail)
router.get('/public/:restaurantId/menus', async (req, res) => {
  try {
    const menus = await RestaurantMenu.find({ restaurantId: req.params.restaurantId });
    res.json(menus);
  } catch (err) {
    console.error('âŒ Failed to fetch public menus:', err);
    res.status(500).json({ message: 'Failed to fetch menus' });
  }
});


module.exports = router;


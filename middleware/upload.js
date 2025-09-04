// middleware/upload.js
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const cloudinary = require('../utils/cloudinary'); // ✅ Correct path and file

const storage = new CloudinaryStorage({
  cloudinary: cloudinary, // ✅ This must not be undefined
  params: {
    folder: 'HotelPennies',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage });

module.exports = upload;

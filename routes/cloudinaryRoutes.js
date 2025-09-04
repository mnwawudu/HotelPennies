// routes/cloudinaryRoutes.js
const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const cloudinary = require('../utils/cloudinary'); // should be cloudinary.v2 configured

const router = express.Router();

// Use memory storage so we fully control Cloudinary upload & get secure_url
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 10,
    fileSize: 5 * 1024 * 1024, // 5MB per file (adjust if needed)
  },
});

// Helper: upload one buffer to Cloudinary and resolve secure_url
const uploadBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'HotelPennies',
        resource_type: 'image',
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (err, result) => {
        if (err) return reject(err);
        return resolve(result.secure_url); // 🔑 always return HTTPS URL
      }
    );
    stream.end(buffer);
  });

router.post('/upload', auth, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Upload each file.buffer and collect secure URLs
    const urls = await Promise.all(req.files.map((f) => uploadBuffer(f.buffer)));

    console.log('✅ Uploaded URLs:', urls);
    res.json({ urls }); // 🔑 matches UploadImageModal expectation
  } catch (err) {
    console.error('❌ Cloudinary upload failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;

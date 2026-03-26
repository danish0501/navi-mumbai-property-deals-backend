'use strict';
const multer = require('multer');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');

// Multer — keep files in memory (we stream them to Cloudinary directly)
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

// Helper — upload a single buffer to Cloudinary
/**
 * @param {Buffer} buffer     - File buffer from Multer memory storage
 * @param {string} folder     - Cloudinary folder path
 * @param {object} [opts]     - Extra Cloudinary upload options
 * @returns {Promise<{url: string, public_id: string}>}
 */
const uploadToCloudinary = (buffer, folder, opts = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );

    Readable.from(buffer).pipe(stream);
  });
};

/**
 * Delete an image from Cloudinary by its public_id.
 * Swallows errors silently (best-effort cleanup).
 *
 * @param {string} publicId
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (_) {
    // best-effort
  }
};

// Multer error middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: err.message, data: null });
  }
  if (err) {
    return res.status(400).json({ success: false, message: err.message, data: null });
  }
  next();
};

module.exports = { upload, uploadToCloudinary, deleteFromCloudinary, handleMulterError };

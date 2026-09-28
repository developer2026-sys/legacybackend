// backend/middleware/upload.js
const multer = require('multer');
const os = require('os');

module.exports = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()), // "/tmp" on Vercel
    filename: (req, file, cb) =>
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s+/g, '_')}`),
  }),
  limits: { fileSize: 4 * 1024 * 1024 }, // Vercel body limit is ~4.5 MB
});
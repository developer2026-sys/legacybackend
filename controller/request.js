'use strict';

const { MemorialRequest, RequestPhoto,Partner } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt=require('bcrypt')
// GET ALL REQUESTS FOR LOGGED IN PARTNER
const getRequests = async (req, res) => {
  try {
    const requests = await MemorialRequest.findAll({
      where: { partnerId: req.partner.id },
      include: [{ model: RequestPhoto, as: 'photos' }],
      order: [['created_at', 'DESC']],
    });

    return res.status(200).json({ requests });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET SINGLE REQUEST
const getRequest = async (req, res) => {
  try {
    const request = await MemorialRequest.findOne({
      where: { id: req.params.id, partnerId: req.partner.id },
      include: [{ model: RequestPhoto, as: 'photos' }],
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    return res.status(200).json({ request });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};




const UPLOAD_DIR = path.join('/tmp/public/files');
 
// Ensure the upload directory exists at startup
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
 
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});
 
const fileFilter = (_req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedExts = /\.(jpeg|jpg|png|webp)$/i;
  const validMime = allowedMimes.includes(file.mimetype);
  const validExt = allowedExts.test(path.extname(file.originalname));
  if (validMime && validExt) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp).'));
  }
}
 
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});
 
// Export the multer middleware so the router can apply it
const uploadPhotos = upload.array('photos', 10); // up to 10 photos per request
 

const createRequest = async (req, res) => {
  try {
    const {
      packageType,
      packagePrice,
      customerName,
      customerPhone,
      customerEmail,
      memorialLocation,
      notes,
    } = req.body;
 
    // ── Validation ──────────────────────────────────────────────────────────
    const required = {
      packageType,
      packagePrice,
      customerName,
      customerPhone,
      customerEmail,
      memorialLocation,
    };
 
    const missing = Object.entries(required)
      .filter(([, v]) => v === undefined || v === null || v === '')
      .map(([k]) => k);
 
    if (missing.length) {
      // Clean up any uploaded files before returning the error
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({
        message: 'Missing required fields.',
        fields: missing,
      });
    }
 
    const validPackages = ['basic_annual', 'premium_annual'];
    if (!validPackages.includes(packageType)) {
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({
        message: `packageType must be one of: ${validPackages.join(', ')}.`,
      });
    }
 
    const price = parseFloat(packagePrice);
    if (isNaN(price) || price < 0) {
      (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
      return res.status(400).json({ message: 'packagePrice must be a valid positive number.' });
    }
 
    // ── Create the request record ────────────────────────────────────────────
    const memorialRequest = await MemorialRequest.create({
      partnerId: req.partner.id,
      packageType,
      packagePrice: price,
      customerName,
      customerPhone,
      customerEmail,
      memorialLocation,
      notes: notes || null,
    });
 
    // ── Persist uploaded photos ──────────────────────────────────────────────
    if (req.files && req.files.length > 0) {
      const photoRecords = req.files.map((file) => ({
        requestId: memorialRequest.id,
        // Store a relative path so the app stays portable
        storagePath: path.relative(path.join(__dirname, '..'), file.path),
      }));
      await RequestPhoto.bulkCreate(photoRecords);
    }
 
    // ── Return the full request with photos ─────────────────────────────────
    const result = await MemorialRequest.findByPk(memorialRequest.id, {
      include: [{ model: RequestPhoto, as: 'photos' }],
    });
 
    return res.status(201).json({ request: result });
  } catch (err) {
    console.log(err.message)
    // Clean up any orphaned uploads on unexpected errors
    (req.files || []).forEach((f) => fs.unlink(f.path, () => {}));
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};







const getAccount = async (req, res) => {
  try {
    const partner = await Partner.findByPk(req.partner.id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
    });
 
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found.' });
    }
 
    return res.status(200).json({ partner });
  } catch (err) {
    console.error('[getAccount]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};


const updateAccount = async (req, res) => {
  try {
    const { username, email } = req.body;
 
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required.' });
    }
 
    const partner = await Partner.findByPk(req.partner.id);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found.' });
    }
 
    // Check username uniqueness if it changed
    if (username.trim() !== partner.username) {
      const existing = await Partner.findOne({
        where: { username: username.trim() },
      });
      if (existing) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }
    }
 
    // Check email uniqueness if it changed and is provided
    if (email && email.trim() !== partner.email) {
      const existingEmail = await Partner.findOne({
        where: { email: email.trim() },
      });
      if (existingEmail) {
        return res.status(409).json({ message: 'That email address is already in use.' });
      }
    }
 
    await partner.update({
      username: username.trim(),
      email: email ? email.trim() : null,
    });
 
    return res.status(200).json({
      message: 'Profile updated successfully.',
      partner: {
        id: partner.id,
        username: partner.username,
        email: partner.email,
        role: partner.role,
      },
    });
  } catch (err) {
    console.error('[updateAccount]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};



const updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
 
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    }
 
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }
 
    const partner = await Partner.findByPk(req.partner.id);
    if (!partner) {
      return res.status(404).json({ message: 'Partner not found.' });
    }
 
    const valid = await bcrypt.compare(currentPassword, partner.password);
    if (!valid) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
 
    const hashed = await bcrypt.hash(newPassword, 12);
    await partner.update({ password: hashed });
 
    return res.status(200).json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[updatePassword]', err);
    return res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = { getRequests, getRequest, createRequest, uploadPhotos,getAccount,updateAccount,updatePassword};
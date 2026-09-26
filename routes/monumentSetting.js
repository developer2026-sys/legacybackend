'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/middleware');
const requireRole = require('../middleware/requireRole');
const {
  uploadMonumentDocs,
  createMonumentSettingRequest,
  getMonumentSettingRequests,
  getMonumentSettingRequest,
} = require('../controller/monumentSetting');

router.get('/monument-setting', authenticate, requireRole('client_admin', 'family_advisor'), getMonumentSettingRequests);
router.get('/monument-setting/:id', authenticate, requireRole('client_admin', 'family_advisor'), getMonumentSettingRequest);

router.post(
  '/monument-setting/create-request',
  authenticate,
  requireRole('client_admin', 'family_advisor'),
  (req, res, next) => {
    uploadMonumentDocs(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Each file must be 10 MB or smaller.' });
      }
      return res.status(400).json({ message: err.message });
    });
  },
  createMonumentSettingRequest,
);

module.exports = router;
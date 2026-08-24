'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/middleware');
const {
  uploadMonumentDocs,
  createMonumentSettingRequest,
  getMonumentSettingRequests,
  getMonumentSettingRequest,
} = require('../controller/monumentSetting');

router.get('/monument-setting', authenticate, getMonumentSettingRequests);
router.get('/monument-setting/:id', authenticate, getMonumentSettingRequest);

router.post(
  '/monument-setting/create-request',
  authenticate,
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
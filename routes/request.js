'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/middleware');
const requireRole = require('../middleware/requireRole');
const {
  getRequests,
  getRequest,
  getRequestOptions,
  getAvailablePricing,
  createRequest,
  saveDraft,
  uploadPhotos,
  updateAccount,
  updatePassword,
  getAccount,
} = require('../controller/request');
const parsePhotos = (req, res, next) => uploadPhotos(req, res, (err) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Each photo must be 10 MB or smaller.' });
  if (err.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ message: 'Unexpected field name. Use "photos" for file uploads.' });
  return res.status(400).json({ message: err.message });
});
router.put('/update-account', authenticate, requireRole('client_admin', 'family_advisor'), updateAccount);
router.put('/password', authenticate, requireRole('client_admin', 'family_advisor'), updatePassword)

router.get('/getAccount', authenticate, requireRole('client_admin', 'family_advisor'), getAccount);

router.get('/', authenticate, requireRole('client_admin', 'family_advisor'), getRequests);
router.get('/request-options', authenticate, requireRole('client_admin', 'family_advisor'), getRequestOptions);
router.get('/available-pricing', authenticate, requireRole('client_admin', 'family_advisor'), getAvailablePricing);
router.post('/drafts', authenticate, requireRole('client_admin', 'family_advisor'), parsePhotos, saveDraft);
router.put('/drafts/:id', authenticate, requireRole('client_admin', 'family_advisor'), parsePhotos, saveDraft);
router.post('/drafts/:id/submit', authenticate, requireRole('client_admin', 'family_advisor'), parsePhotos, createRequest);
router.get('/:id', authenticate, requireRole('client_admin', 'family_advisor'), getRequest);

router.post(
    '/create-request',
    authenticate,
    requireRole('client_admin', 'family_advisor'),
    parsePhotos,
    createRequest,
  );




module.exports = router;
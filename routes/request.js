'use strict';

const express = require('express');
const router = express.Router();

const authenticate = require('../middleware/middleware');
const { getRequests, getRequest, createRequest, uploadPhotos,updateAccount,updatePassword,getAccount } = require('../controller/request');
router.put('/update-account', authenticate,updateAccount);
router.put('/password', authenticate,updatePassword)

router.get('/getAccount', authenticate,getAccount);

router.get('/', authenticate, getRequests);
router.get('/:id', authenticate, getRequest);

router.post(
    '/create-request',
    authenticate,
    (req, res, next) => {
      uploadPhotos(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Each photo must be 10 MB or smaller.' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ message: 'Unexpected field name. Use "photos" for file uploads.' });
        }
        return res.status(400).json({ message: err.message });
      });
    },
    
    createRequest,
  );




 
module.exports = router;
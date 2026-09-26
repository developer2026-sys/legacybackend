'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const authenticate = require('../middleware/middleware');
const adminAuth = require('../middleware/admin');
const requireRole = require('../middleware/requireRole');

const PHOTOS_ROOT = '/tmp/public/files';

module.exports = (models) => {
  const router = express.Router();
  const { MemorialRequest: RequestModel, RequestPhoto: PhotoModel } = models;
  const {
    MonumentSettingRequest: MonumentRequestModel,
    MonumentSettingDocument: MonumentDocumentModel,
  } = models;

  // Dispatch to the existing server-side authentication path for the token
  // type; the selected middleware still verifies the signature and live user.
  const authenticateFileViewer = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'change_me_in_env');
    } catch (_error) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    if (decoded.role === 'super_admin') {
      return adminAuth(req, res, () => requireRole('super_admin')(req, res, next));
    }
    return authenticate(req, res, () => requireRole('client_admin', 'family_advisor')(req, res, next));
  };

  router.get('/:filename', authenticateFileViewer, async (req, res) => {
    try {
      const filename = req.params.filename;
      if (
        !filename
        || filename === '.'
        || filename === '..'
        || path.basename(filename) !== filename
        || !/^[A-Za-z0-9._ -]{1,255}$/.test(filename)
      ) {
        return res.status(404).json({ message: 'File not found.' });
      }

      const escapedFilename = filename.replace(/[\\%_]/g, '\\$&');
      const where = {
        storagePath: { [Op.like]: `%/${escapedFilename}` },
      };
      const requestScope = {};
      if (req.partner) {
        where.clientAccountId = req.clientAccountId;
        requestScope.clientAccountId = req.clientAccountId;
        if (req.userRole === 'family_advisor' || req.accountRole === 'family_advisor') {
          requestScope.partnerId = req.partner.id;
        }
      }

      const photo = await PhotoModel.findOne({
        where,
        include: [{
          model: RequestModel,
          as: 'request',
          required: true,
          where: requestScope,
          attributes: ['id'],
        }],
      });
      if (!photo || path.basename(photo.storagePath) !== filename) {
        return res.status(404).json({ message: 'File not found.' });
      }

      const rootPath = path.resolve(PHOTOS_ROOT);
      const filePath = path.resolve(rootPath, filename);
      if (!filePath.startsWith(`${rootPath}${path.sep}`)) {
        return res.status(404).json({ message: 'File not found.' });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' });
      }
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) {
          res.status(error.statusCode || 404).json({ message: 'File not found.' });
        }
      });
    } catch (error) {
      console.error('[files.get]', error);
      return res.status(500).json({ message: 'Unable to load file.' });
    }
  });

  router.get('/monument-setting/:documentId', authenticateFileViewer, async (req, res) => {
    try {
      if (!/^[1-9]\d*$/.test(req.params.documentId)) {
        return res.status(404).json({ message: 'File not found.' });
      }

      const where = { id: Number(req.params.documentId) };
      const requestScope = {};
      if (req.partner) {
        where.clientAccountId = req.clientAccountId;
        requestScope.clientAccountId = req.clientAccountId;
        if (req.userRole === 'family_advisor' || req.accountRole === 'family_advisor') {
          requestScope.partnerId = req.partner.id;
        }
      }

      const document = await MonumentDocumentModel.findOne({
        where,
        include: [{
          model: MonumentRequestModel,
          as: 'request',
          required: true,
          where: requestScope,
          attributes: ['id'],
        }],
      });
      if (!document) return res.status(404).json({ message: 'File not found.' });

      const rootPath = path.resolve(__dirname, '..', 'uploads', 'monument-setting');
      const filePath = path.resolve(rootPath, path.basename(document.storagePath));
      if (!filePath.startsWith(`${rootPath}${path.sep}`) || !fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found.' });
      }
      return res.sendFile(filePath, (error) => {
        if (error && !res.headersSent) {
          res.status(error.statusCode || 404).json({ message: 'File not found.' });
        }
      });
    } catch (error) {
      console.error('[files.monument-setting.get]', error);
      return res.status(500).json({ message: 'Unable to load file.' });
    }
  });

  return router;
};
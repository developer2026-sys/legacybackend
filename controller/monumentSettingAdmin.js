'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const emailService = require('../emailService');
const {
  NOTIFICATION_EVENTS,
  createNotificationService,
} = require('../services/notificationService');
const { createNotificationRecipients } = require('../services/notificationRecipients');

/* ------------------------------------------------------------------ */
/* Admin-side Monument Setting controller                              */
/* Factory pattern to match controller/admin.js — call with `models`   */
/* (or reuse models imported at the top of routes/admin.js).           */
/* ------------------------------------------------------------------ */

const VALID_STATUSES = [
  'new', 'under_review', 'cemetery_verification', 'quote_pending',
  'awaiting_approval', 'approved', 'scheduling', 'scheduled',
  'in_progress', 'completed', 'on_hold', 'cancelled',
];
const COMPLETION_UPLOAD_DIR = path.join('/tmp/public/files');

const completionPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(COMPLETION_UPLOAD_DIR, { recursive: true });
      cb(null, COMPLETION_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const safeExtension = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}${safeExtension}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(allowed.includes(file.mimetype) ? null : new Error('Completion photos must be JPG, PNG, or WebP images.'), allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'beforePhoto', maxCount: 1 },
  { name: 'afterPhoto', maxCount: 1 },
]);

module.exports = (models) => {
  const {
    MonumentSettingRequest,
    MonumentSettingDocument,
    MonumentSettingStatusHistory,
    Partner,
  } = models;

  const notificationService = createNotificationService({ channels: { email: emailService } });
  const notificationRecipients = createNotificationRecipients({ Partner });

  const notifyStatusChange = async (request, status) => {
    try {
      const recipients = await notificationRecipients.forMonumentSettingStatusChanged(request);
      const requestNumber = request.requestNumber || `#${request.id}`;
      const familyName = [request.familyFirstName, request.familyLastName].filter(Boolean).join(' ');
      const results = await notificationService.sendNotifications({
        type: NOTIFICATION_EVENTS.MONUMENT_SETTING_STATUS_CHANGED,
        payload: {
          requestNumber,
          familyName,
          cemeteryName: request.cemeteryName,
          completedAt: request.completedAt,
          status,
          scheduledDate: request.scheduledDate,
        },
      }, recipients);
      for (const result of results) {
        if (result.status === 'rejected') {
          console.error('[monument status notification] Delivery failed:', result.reason?.message || result.reason);
        }
      }
    } catch (error) {
      // Email delivery must not roll back the saved completion state.
      console.error('[monument status notification] Could not notify recipients:', error.message);
    }
  };

  /* GET /admin/monument-setting — list all, optional filters via query params */
  const getAllMonumentSettingRequests = async (req, res) => {
    try {
      const where = {};
      if (req.query.partnerId) where.partnerId = req.query.partnerId;
      if (req.query.status) where.status = req.query.status;
      if (req.query.familyState) where.familyState = req.query.familyState;
      if (req.query.territory) where.territory = req.query.territory;

      const requests = await MonumentSettingRequest.findAll({
        where,
        include: [
          { model: MonumentSettingDocument, as: 'documents' },
          { model: MonumentSettingStatusHistory, as: 'statusHistory' },
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email'] },
        ],
        order: [['createdAt', 'DESC']],
      });

      return res.json({ requests });
    } catch (err) {
      console.error('getAllMonumentSettingRequests error:', err);
      return res.status(500).json({ message: 'Failed to fetch monument setting requests.' });
    }
  };

  /* GET /admin/monument-setting/:id — single request, no partner scoping (admin sees all) */
  const getMonumentSettingRequest = async (req, res) => {
    try {
      const { id } = req.params;

      const request = await MonumentSettingRequest.findByPk(id, {
        include: [
          { model: MonumentSettingDocument, as: 'documents' },
          { model: MonumentSettingStatusHistory, as: 'statusHistory' },
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email'] },
        ],
      });

      if (!request) {
        return res.status(404).json({ message: 'Monument setting request not found.' });
      }

      return res.json({ request });
    } catch (err) {
      console.error('getMonumentSettingRequest (admin) error:', err);
      return res.status(500).json({ message: 'Failed to fetch monument setting request.' });
    }
  };

  /* PATCH /admin/monument-setting/:id — combined update.
     Accepts a partial body; only recognized fields are applied. */
  const updateMonumentSettingRequest = async (req, res) => {
    try {
      const { id } = req.params;
      const request = await MonumentSettingRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({ message: 'Monument setting request not found.' });
      }

      const b = req.body;
      const updates = {};

      if (b.status !== undefined) {
        if (!VALID_STATUSES.includes(b.status)) {
          return res.status(400).json({ message: `Invalid status: ${b.status}` });
        }
        updates.status = b.status;
        if (b.status === 'completed' && !request.completedAt) {
          updates.completedAt = new Date();
        }
      }
      if (b.quoteAmount !== undefined) {
        const amt = b.quoteAmount === '' || b.quoteAmount === null ? null : Number(b.quoteAmount);
        if (amt !== null && (Number.isNaN(amt) || amt < 0)) {
          return res.status(400).json({ message: 'quoteAmount must be a positive number.' });
        }
        updates.quoteAmount = amt;
      }
      if (b.scheduledDate !== undefined) {
        updates.scheduledDate = b.scheduledDate || null;
      }
      if (b.assignedSettingCompany !== undefined) {
        updates.assignedSettingCompany = b.assignedSettingCompany || null;
      }
      if (b.assignedCoordinator !== undefined) {
        updates.assignedCoordinator = b.assignedCoordinator || null;
      }
      if (b.internalNotes !== undefined) {
        updates.internalNotes = b.internalNotes || null;
      }
      if (b.serviceNotes !== undefined) {
        updates.serviceNotes = typeof b.serviceNotes === 'string' ? b.serviceNotes.trim() || null : null;
      }

      if (b.status === 'completed') {
        const serviceNotes = updates.serviceNotes !== undefined ? updates.serviceNotes : request.serviceNotes;
        const completionDocuments = await MonumentSettingDocument.findAll({
          where: { monumentSettingRequestId: request.id },
          attributes: ['documentType'],
        });
        const documentTypes = new Set(completionDocuments.map((document) => document.documentType));
        const missing = [];
        if (!serviceNotes) missing.push('service notes');
        if (!documentTypes.has('before_photo')) missing.push('before photo');
        if (!documentTypes.has('after_photo')) missing.push('after photo');
        if (missing.length) {
          return res.status(400).json({
            message: `Completion requires ${missing.join(', ')}.`,
            missing,
          });
        }
      }

      const previousStatus = request.status;
      await MonumentSettingRequest.sequelize.transaction(async (transaction) => {
        await request.update(updates, { transaction });
        if (updates.status && updates.status !== previousStatus) {
          await MonumentSettingStatusHistory.create({
            monumentSettingRequestId: request.id,
            fromStatus: previousStatus,
            toStatus: updates.status,
            changedByUserId: req.admin?.id || null,
            changedByRole: req.admin?.role || req.userRole || 'super_admin',
          }, { transaction });
        }
      });

      const full = await MonumentSettingRequest.findByPk(id, {
        include: [
          { model: MonumentSettingDocument, as: 'documents' },
          { model: MonumentSettingStatusHistory, as: 'statusHistory' },
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email'] },
        ],
      });

      if (updates.status && updates.status !== previousStatus) {
        await notifyStatusChange(full, updates.status);
      }

      return res.json({ request: full });
    } catch (err) {
      console.error('updateMonumentSettingRequest error:', err);
      return res.status(500).json({ message: 'Failed to update monument setting request.' });
    }
  };

  /* POST /admin/monument-setting/:id/completion-photos */
  const saveCompletionPhotos = async (req, res) => {
    try {
      const request = await MonumentSettingRequest.findByPk(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Monument setting request not found.' });
      }

      const rows = [];
      for (const [fieldName, documentType] of [
        ['beforePhoto', 'before_photo'],
        ['afterPhoto', 'after_photo'],
      ]) {
        for (const file of req.files?.[fieldName] || []) {
          rows.push({
            monumentSettingRequestId: request.id,
            clientAccountId: request.clientAccountId,
            documentType,
            storagePath: file.path,
          });
        }
      }
      if (!rows.length) {
        return res.status(400).json({ message: 'Select a before photo, an after photo, or both.' });
      }

      const documents = await MonumentSettingDocument.bulkCreate(rows);
      return res.status(201).json({ documents });
    } catch (err) {
      console.error('saveCompletionPhotos error:', err);
      return res.status(500).json({ message: 'Failed to upload completion photos.' });
    }
  };

  /* POST /admin/monument-setting/:id/documents — admin document upload.
     Reuses the same multer config as the partner-side create flow.
     ASSUMPTION: uploadMonumentDocs is exported from the partner controller
     (controller/monumentSetting.js) — imported where this route is mounted. */
  const uploadMonumentSettingDocuments = async (req, res) => {
    try {
      const { id } = req.params;
      const request = await MonumentSettingRequest.findByPk(id);
      if (!request) {
        return res.status(404).json({ message: 'Monument setting request not found.' });
      }

      const files = req.files?.additionalDocs || req.files?.documents || [];
      if (!files.length) {
        return res.status(400).json({ message: 'No files uploaded.' });
      }

      const docRows = files.map((file) => ({
        monumentSettingRequestId: request.id,
        clientAccountId: request.clientAccountId,
        documentType: 'additional',
        storagePath: file.path,
      }));

      const created = await MonumentSettingDocument.bulkCreate(docRows);

      return res.status(201).json({ documents: created });
    } catch (err) {
      console.error('uploadMonumentSettingDocuments error:', err);
      return res.status(500).json({ message: 'Failed to upload documents.' });
    }
  };

  return {
    getAllMonumentSettingRequests,
    getMonumentSettingRequest,
    updateMonumentSettingRequest,
    completionPhotoUpload,
    saveCompletionPhotos,
    uploadMonumentSettingDocuments,
  };
};
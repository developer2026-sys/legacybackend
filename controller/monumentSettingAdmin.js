'use strict';

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

module.exports = (models) => {
  const {
    MonumentSettingRequest,
    MonumentSettingDocument,
    Partner,
  } = models;

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

      await request.update(updates);

      const full = await MonumentSettingRequest.findByPk(id, {
        include: [
          { model: MonumentSettingDocument, as: 'documents' },
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email'] },
        ],
      });

      return res.json({ request: full });
    } catch (err) {
      console.error('updateMonumentSettingRequest error:', err);
      return res.status(500).json({ message: 'Failed to update monument setting request.' });
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
    uploadMonumentSettingDocuments,
  };
};
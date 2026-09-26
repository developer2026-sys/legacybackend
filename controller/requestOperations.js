'use strict';

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Op } = require('sequelize');
const {
  MemorialRequest,
  RequestPhoto,
  RequestStatusHistory,
  AuditLog,
  WorkOrder,
  Schedule,
  Location,
  ClientAccount,
  Partner,
} = require('../models');
const {
  transitionRequestRecord,
  getAllowedRequestTransitions,
} = require('../utils/requestStatus');
const { recordRequestStatusAudit } = require('../utils/requestAudit');
const {
  NOTIFICATION_EVENTS,
  createNotificationService,
} = require('../services/notificationService');
const { createNotificationRecipients } = require('../services/notificationRecipients');

const completionStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    const directory = path.join('/tmp/public/files');
    fs.mkdirSync(directory, { recursive: true });
    callback(null, directory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    callback(null, `${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}${extension}`);
  },
});

const completionUpload = multer({
  storage: completionStorage,
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    callback(allowed.includes(file.mimetype)
      ? null
      : new Error('Completion photos must be JPG, PNG, or WebP images.'), allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'beforePhoto', maxCount: 1 },
  { name: 'afterPhoto', maxCount: 1 },
]);

const asNullableString = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const asBooleanChecklist = (value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const hasCompletedChecklist = (checklist) => Object.values(checklist || {}).every(Boolean)
  && Object.keys(checklist || {}).length > 0;

module.exports = (models = {}) => {
  const Request = models.MemorialRequest || MemorialRequest;
  const Photo = models.RequestPhoto || RequestPhoto;
  const History = models.RequestStatusHistory || RequestStatusHistory;
  const Audit = models.AuditLog || AuditLog;
  const Order = models.WorkOrder || WorkOrder;
  const Calendar = models.Schedule || Schedule;
  const Account = models.ClientAccount || ClientAccount;
  const User = models.Partner || Partner;
  const Property = models.Location || Location;
  const notificationService = createNotificationService();
  const notificationRecipients = createNotificationRecipients({
    Partner: User,
    ClientAccount: Account,
    Op,
  });

  const sendLifecycleNotification = async (request, status, reason) => {
    try {
      const recipients = await notificationRecipients.forRequestStatusChanged(request);
      await notificationService.sendNotifications({
        type: NOTIFICATION_EVENTS.REQUEST_STATUS_CHANGED,
        payload: {
          requestNumber: request.requestNumber || `#${request.id}`,
          customerName: request.customerName,
          propertyName: request.location?.name || request.memorialLocation,
          status,
          reason,
          scheduledDate: request.workOrder?.schedules?.[0]?.scheduledDate || null,
          completedAt: request.workOrder?.completedAt || null,
          completionPhotosAvailable: status === 'COMPLETED',
        },
      }, recipients);
    } catch (error) {
      // Notification delivery must not roll back an operational update.
      console.error('[request lifecycle notification]', error.message);
    }
  };

  const loadRequest = (id) => Request.findByPk(id, {
    include: [
      { model: Property, as: 'location', attributes: ['id', 'name', 'city', 'state'] },
      { model: Photo, as: 'photos', required: false },
      {
        model: Order,
        as: 'workOrder',
        include: [{ model: Calendar, as: 'schedules', required: false }],
      },
      { model: History, as: 'statusHistory', required: false },
    ],
  });

  const appendStatus = async (request, nextStatus, req, reason, transaction) => {
    const previousStatus = request.status;
    if (previousStatus === nextStatus) return null;
    transitionRequestRecord(request, nextStatus);
    await request.save({ transaction });
    const history = await History.create({
      requestId: request.id,
      clientAccountId: request.clientAccountId,
      fromStatus: previousStatus,
      toStatus: nextStatus,
      reason: reason || null,
      changedByUserId: req.admin?.id || null,
      changedByRole: req.admin?.role || 'super_admin',
    }, { transaction });
    await recordRequestStatusAudit(Audit, req, request, previousStatus, nextStatus, reason, { transaction });
    return history;
  };

  const updateOperations = async (req, res) => {
    const request = await Request.findByPk(req.params.id, {
      include: [{ model: Order, as: 'workOrder', include: [{ model: Calendar, as: 'schedules', required: false }] }],
    });
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const body = req.body || {};
    const operation = String(body.operation || '').toLowerCase();
    const scheduleDate = asNullableString(body.scheduledDate);
    const technicianName = asNullableString(body.technicianName);
    const serviceNotes = asNullableString(body.serviceNotes);
    const internalNotes = asNullableString(body.internalNotes);
    const completionDetails = asNullableString(body.completionDetails);
    const completionChecklist = asBooleanChecklist(body.completionChecklist);
    const reason = asNullableString(body.reason);

    if (operation === 'schedule') {
      if (!scheduleDate || !technicianName) {
        return res.status(400).json({ message: 'Scheduled date and technician/provider are required.' });
      }
      if (!['PAID', 'PENDING_SCHEDULING', 'SCHEDULED', 'IN_PROGRESS'].includes(request.status)) {
        return res.status(409).json({
          message: 'Only paid requests can be scheduled.',
          allowedTransitions: getAllowedRequestTransitions(request.status),
        });
      }
    }

    if (operation === 'start' && !['SCHEDULED', 'IN_PROGRESS'].includes(request.status)) {
      return res.status(409).json({ message: 'Only scheduled requests can be started.' });
    }

    if (operation === 'complete' && !['IN_PROGRESS', 'COMPLETED'].includes(request.status)) {
      return res.status(409).json({ message: 'Only in-progress requests can be completed.' });
    }

    const currentPhotos = await Photo.findAll({ where: { requestId: request.id } });
    const incomingBefore = req.files?.beforePhoto?.[0];
    const incomingAfter = req.files?.afterPhoto?.[0];
    const hasBefore = Boolean(incomingBefore) || currentPhotos.some((photo) => photo.attachmentType === 'before_photo');
    const hasAfter = Boolean(incomingAfter) || currentPhotos.some((photo) => photo.attachmentType === 'after_photo');

    if (operation === 'complete') {
      const currentOrder = request.workOrder;
      const missing = [];
      if (!hasBefore) missing.push('before photo');
      if (!hasAfter) missing.push('after photo');
      if (!(serviceNotes || currentOrder?.serviceNotes)) missing.push('service notes');
      if (!(technicianName || currentOrder?.assignedTechnicianName)) missing.push('technician/provider');
      if (!(completionDetails || currentOrder?.completionDetails)) missing.push('completion details');
      if (!hasCompletedChecklist(
        Object.keys(completionChecklist).length ? completionChecklist : currentOrder?.completionChecklist,
      )) missing.push('completion checklist');
      if (missing.length) {
        return res.status(400).json({
          message: `Completion requires ${missing.join(', ')}.`,
          missing,
        });
      }
    }

    const savedFiles = [];
    const result = await Request.sequelize.transaction(async (transaction) => {
      const [order] = await Order.findOrCreate({
        where: { requestId: request.id },
        defaults: {
          requestId: request.id,
          clientAccountId: request.clientAccountId,
          locationId: request.locationId,
          workOrderNumber: `WO-${request.requestNumber || request.id}`,
          status: 'PENDING',
        },
        transaction,
      });

      const orderUpdates = {};
      if (technicianName !== null) orderUpdates.assignedTechnicianName = technicianName;
      if (internalNotes !== null) orderUpdates.internalNotes = internalNotes;
      if (serviceNotes !== null) orderUpdates.serviceNotes = serviceNotes;
      if (completionDetails !== null) orderUpdates.completionDetails = completionDetails;
      if (Object.keys(completionChecklist).length) orderUpdates.completionChecklist = completionChecklist;
      if (operation === 'start') {
        orderUpdates.status = 'IN_PROGRESS';
        orderUpdates.actualStartAt = order.actualStartAt || new Date();
      }
      if (operation === 'complete') {
        orderUpdates.status = 'COMPLETED';
        orderUpdates.completedAt = order.completedAt || new Date();
      }
      if (Object.keys(orderUpdates).length) await order.update(orderUpdates, { transaction });

      let schedule = request.workOrder?.schedules?.[0] || await Calendar.findOne({
        where: { requestId: request.id },
        order: [['scheduled_date', 'DESC'], ['id', 'DESC']],
        transaction,
      });
      if (operation === 'schedule') {
        if (!schedule) {
          schedule = await Calendar.create({
            requestId: request.id,
            workOrderId: order.id,
            clientAccountId: request.clientAccountId,
            locationId: request.locationId,
            scheduledDate: scheduleDate,
            windowStart: asNullableString(body.windowStart),
            windowEnd: asNullableString(body.windowEnd),
            technicianName,
            status: 'SCHEDULED',
            notes: internalNotes,
          }, { transaction });
        } else {
          await schedule.update({
            workOrderId: order.id,
            locationId: request.locationId,
            scheduledDate: scheduleDate,
            windowStart: asNullableString(body.windowStart),
            windowEnd: asNullableString(body.windowEnd),
            technicianName,
            status: 'SCHEDULED',
            notes: internalNotes,
          }, { transaction });
        }
        await order.update({ status: 'SCHEDULED' }, { transaction });
      }

      if (operation === 'start') {
        if (schedule) await schedule.update({ status: 'IN_PROGRESS' }, { transaction });
      }
      if (operation === 'complete' && schedule) {
        await schedule.update({ status: 'COMPLETED' }, { transaction });
      }

      let nextStatus = null;
      if (operation === 'schedule' && request.status !== 'SCHEDULED') nextStatus = 'SCHEDULED';
      if (operation === 'start' && request.status !== 'IN_PROGRESS') nextStatus = 'IN_PROGRESS';
      if (operation === 'complete' && request.status !== 'COMPLETED') nextStatus = 'COMPLETED';
      const history = nextStatus
        ? await appendStatus(request, nextStatus, req, reason, transaction)
        : null;

      if (incomingBefore) {
        savedFiles.push({ file: incomingBefore, type: 'before_photo' });
      }
      if (incomingAfter) {
        savedFiles.push({ file: incomingAfter, type: 'after_photo' });
      }
      for (const { file, type } of savedFiles) {
        await Photo.create({
          requestId: request.id,
          clientAccountId: request.clientAccountId,
          storagePath: path.relative(path.join(__dirname, '..'), file.path),
          attachmentType: type,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedByUserId: req.admin.id,
        }, { transaction });
      }
      return { history, nextStatus, order, schedule };
    });

    const full = await loadRequest(request.id);
    if (result.nextStatus) await sendLifecycleNotification(full, result.nextStatus, reason);
    return res.json({
      message: operation === 'complete' ? 'Request completed.' : 'Request operations updated.',
      request: full,
    });
  };

  const parseCompletionUpload = (req, res, next) => completionUpload(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Each completion photo must be 10 MB or smaller.' });
    }
    return res.status(400).json({ message: error.message });
  });

  const uploadCompletionPhotos = async (req, res) => {
    const request = await Request.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const beforePhoto = req.files?.beforePhoto?.[0];
    const afterPhoto = req.files?.afterPhoto?.[0];
    if (!beforePhoto && !afterPhoto) {
      return res.status(400).json({ message: 'Select a before photo, an after photo, or both.' });
    }
    const created = [];
    for (const [file, type] of [[beforePhoto, 'before_photo'], [afterPhoto, 'after_photo']]) {
      if (!file) continue;
      created.push(await Photo.create({
        requestId: request.id,
        clientAccountId: request.clientAccountId,
        storagePath: path.relative(path.join(__dirname, '..'), file.path),
        attachmentType: type,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        uploadedByUserId: req.admin.id,
      }));
    }
    return res.status(201).json({ documents: created });
  };

  return {
    parseCompletionUpload,
    updateOperations,
    uploadCompletionPhotos,
  };
};
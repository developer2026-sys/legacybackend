'use strict';

const { Op } = require('sequelize');

const { uploadAndCleanup } = require('../utils/cloudinary');
const { syncMemorialRequest } = require('../airtable'); 

const multer = require('multer');


const {
  MemorialRequest,
  RequestPhoto,
  Partner,
  Location,
  ClientAccount,
  PricingConfiguration,
  PricingPackage,
  RequestStatusHistory,
  Invoice,
  MonumentSettingRequest,
  MonumentSettingDocument,
  MonumentSettingStatusHistory,
  AuditLog,
  PartnerTeamMember,
  WorkOrder,
  Schedule,
} = require('../models');

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt=require('bcrypt')
const {
  getPriceVisibility,
  serializeWithPriceVisibility,
} = require('../utils/priceVisibility');
const {
  assertInitialRequestStatus,
  assertRequestTransition,
} = require('../utils/requestStatus');
const {
  ADVISOR_EDITABLE_STATUSES,
  buildAdvisorRequestScope,
  canAdvisorEditRequest,
  buildAdvisorSubmissionValues,
} = require('../utils/advisorRequestWorkflow');
const {
  NOTIFICATION_EVENTS,
  createNotificationService,
} = require('../services/notificationService');
const { createNotificationRecipients } = require('../services/notificationRecipients');
const { recordRequestStatusAudit } = require('../utils/requestAudit');

const notificationService = createNotificationService();
const notificationRecipients = createNotificationRecipients({ Partner, ClientAccount, Op });

const getRequestScope = async (req) => {
  const familyAdvisor = req.userRole === 'family_advisor'
    || req.accountRole === 'family_advisor'
    || req.partner?.accountRole === 'family_advisor';

  const clientAdmin = req.userRole === 'client_admin'
    || req.accountRole === 'client_admin'
    || req.partner?.accountRole === 'client_admin';

  
  if (clientAdmin) {
    return { clientAccountId: req.clientAccountId };
  }

  const teamMember = !familyAdvisor && PartnerTeamMember?.findOne
    ? await PartnerTeamMember.findOne({
      where: {
        partner_id: req.partner.id,
        client_account_id: req.clientAccountId,
      },
      attributes: ['id'],
    })
    : null;

  return {
    clientAccountId: req.clientAccountId,
    ...(familyAdvisor || teamMember
      ? buildAdvisorRequestScope(req.partner.id)
      : {}),
  };
};

const clientInvoiceInclude = (familyAdvisor, clientAccountId) => familyAdvisor ? [] : [{
  model: Invoice,
  as: 'invoice',
  where: { clientAccountId },
  required: false,
  attributes: [
    'id',
    'invoiceNumber',
    'amount',
    'restorationAmount',
    'revenueShareAmount',
    'issuedAt',
    'accountsPayableEmail',
    'locationId',
    'packageId',
    'paymentStatus',
    'paidDate',
    'paidTime',
  ],
}];

const operationsInclude = (clientAccountId) => !WorkOrder ? [] : [{
  model: WorkOrder,
  as: 'workOrder',
  where: { clientAccountId },
  required: false,
  include: Schedule ? [{
    model: Schedule,
    as: 'schedules',
    where: { clientAccountId },
    required: false,
  }] : [],
}];




const settingRequestInclude = (clientAccountId) => !MonumentSettingRequest ? [] : [{
  model: MonumentSettingRequest,
  as: 'settingRequests',
  where: { clientAccountId },
  required: false,
  include: [
    { model: MonumentSettingDocument, as: 'documents', where: { clientAccountId }, required: false },
    { model: MonumentSettingStatusHistory, as: 'statusHistory' },
  ],
}];

// GET ALL REQUESTS FOR LOGGED IN PARTNER
const getRequests = async (req, res) => {
  try {
    const visibility = await getPriceVisibility(req, ClientAccount);
    const requests = await MemorialRequest.findAll({
      where: await getRequestScope(req),
      include: [
        { model: RequestPhoto, as: 'photos', where: { clientAccountId: req.clientAccountId }, required: false },
        { model: PricingPackage, as: 'package' },
        { model: RequestStatusHistory, as: 'statusHistory', where: { clientAccountId: req.clientAccountId }, required: false },
        ...clientInvoiceInclude(visibility.familyAdvisor, req.clientAccountId),
        ...operationsInclude(req.clientAccountId),
        ...settingRequestInclude(req.clientAccountId),
      ],
      order: [['created_at', 'DESC']],
    });

    const visibleRequests = requests.filter((request) =>
      request.status !== 'DRAFT' || request.partnerId === req.partner.id
    );
    return res.status(200).json({
      requests: serializeWithPriceVisibility(visibleRequests, visibility),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// GET SINGLE REQUEST
const getRequest = async (req, res) => {
  try {
    const visibility = await getPriceVisibility(req, ClientAccount);
    const request = await MemorialRequest.findOne({
      where: { id: req.params.id, ...await getRequestScope(req) },
      include: [
        { model: RequestPhoto, as: 'photos', where: { clientAccountId: req.clientAccountId }, required: false },
        { model: PricingPackage, as: 'package' },
        { model: RequestStatusHistory, as: 'statusHistory', where: { clientAccountId: req.clientAccountId }, required: false },
        ...clientInvoiceInclude(visibility.familyAdvisor, req.clientAccountId),
        ...operationsInclude(req.clientAccountId),
        ...settingRequestInclude(req.clientAccountId),
      ],
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found.' });
    }
    if (request.status === 'DRAFT' && request.partnerId !== req.partner.id) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    return res.status(200).json({
      request: serializeWithPriceVisibility(request, visibility),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

const getAvailablePricing = async (req, res) => {
  try {
    const visibility = await getPriceVisibility(req, ClientAccount);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await PricingConfiguration.findAll({
      where: {
        clientAccountId: req.clientAccountId,
        effectiveDate: { [Op.lte]: today },
      },
      include: [
        { model: PricingPackage, as: 'package', required: true },
        {
          model: Location,
          as: 'location',
          required: true,
          where: { clientAccountId: req.clientAccountId, status: 'active' },
        },
      ],
      order: [['effective_date', 'DESC'], ['created_at', 'DESC'], ['id', 'DESC']],
    });

    const latest = new Map();
    for (const row of rows) {
      const key = `${row.locationId}:${row.packageId}`;
      if (!latest.has(key)) latest.set(key, row);
    }
    return res.status(200).json({
      pricing: serializeWithPriceVisibility(Array.from(latest.values()), visibility),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load current pricing.' });
  }
};

const getRequestOptions = async (req, res) => {
  try {
    const [properties, clientAccount, visibility] = await Promise.all([
      Location.findAll({
        where: { clientAccountId: req.clientAccountId, status: 'active' },
        attributes: ['id', 'name', 'city', 'state'],
        order: [['name', 'ASC']],
      }),
      ClientAccount.findByPk(req.clientAccountId, {
        attributes: ['id', 'requestPhotosRequired'],
      }),
      getPriceVisibility(req, ClientAccount),
    ]);
    return res.status(200).json({
      properties,
      photosRequired: Boolean(clientAccount?.requestPhotosRequired),
      priceVisibility: visibility.mode,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Unable to load request options.' });
  }
};




const UPLOAD_DIR = path.join('/tmp/public/files');
 
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
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

const os = require('os');

const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname.replace(/\s+/g, '_')}`),
});

const uploadPhotos = multer({
  storage: photoStorage,
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG or WEBP images are allowed.'));
  },
  limits: { fileSize: 4 * 1024 * 1024, files: 10 },
}).array('photos', 10);




const fieldValue = (value) => String(value ?? '').trim();

const findProperty = (locationId, clientAccountId) => Location.findOne({
  where: { id: locationId, clientAccountId, status: 'active' },
});

const getRequestFields = (body, property) => ({
  customerName: fieldValue(body.customerName),
  customerPhone: fieldValue(body.customerPhone),
  customerEmail: fieldValue(body.customerEmail),
  nameOnMemorial: fieldValue(body.nameOnMemorial),
  memorialSize: fieldValue(body.memorialSize),
  memorialType: fieldValue(body.memorialType),
  memorialLocation: property?.name || '',
  section: fieldValue(body.section),
  lot: fieldValue(body.lot),
  space: fieldValue(body.space),
  vaseInfo: fieldValue(body.vaseInfo),
  notes: fieldValue(body.notes),
  term: fieldValue(body.term) || null,
});

const validateSubmission = ({ fields, locationId, pricingId, photosRequired, existingPhotoCount }) => {
  const required = {
    customerName: fields.customerName,
    customerPhone: fields.customerPhone,
    customerEmail: fields.customerEmail,
    nameOnMemorial: fields.nameOnMemorial,
    memorialSize: fields.memorialSize,
    memorialType: fields.memorialType,
    section: fields.section,
    lot: fields.lot,
    space: fields.space,
    vaseInfo: fields.vaseInfo,
    notes: fields.notes,
    locationId,
    pricingId,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => value === undefined || value === null || String(value).trim() === '')
    .map(([key]) => key);
  if (fields.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.customerEmail)) {
    missing.push('customerEmail');
  }
  if (fields.memorialType && !['Upright', 'Flat Marker', 'Slant', 'Bench', 'Granite', 'Bronze', 'Other'].includes(fields.memorialType)) {
    missing.push('memorialType');
  }
  if (fields.memorialSize.length > 120) missing.push('memorialSize');
  if (photosRequired && !existingPhotoCount) missing.push('photos');
  if (existingPhotoCount > 10) missing.push('photos');
  return missing;
};

const generateRequestNumber = async () => {
  let requestNumber;
  do {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    requestNumber = `LLC-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  } while (await MemorialRequest.findOne({ where: { requestNumber } }));
  return requestNumber;
};

const getCurrentPricing = async (pricingId, locationId, clientAccountId) => {
  const today = new Date().toISOString().slice(0, 10);
  const pricing = await PricingConfiguration.findOne({
    where: { id: pricingId, clientAccountId, locationId, effectiveDate: { [Op.lte]: today } },
    include: [
      { model: PricingPackage, as: 'package' },
      { model: Location, as: 'location' },
    ],
  });
  if (!pricing || !pricing.package || !pricing.location) return null;
  const current = await PricingConfiguration.findOne({
    where: {
      clientAccountId,
      locationId: pricing.locationId,
      packageId: pricing.packageId,
      effectiveDate: { [Op.lte]: today },
    },
    order: [['effective_date', 'DESC'], ['created_at', 'DESC'], ['id', 'DESC']],
  });
  return current?.id === pricing.id ? pricing : null;
};


const removeIncomingFiles = (req) => {
  (req.files || []).forEach((file) => {
    if (file?.path) fs.unlink(file.path, () => {});
  });
};
const persistPhotos = async (req, requestId) => {
  const files = req.files || [];
  const saved = [];
  for (const file of files) {
    const result = await uploadAndCleanup(file, `requests/${requestId}`);
    const photo = await RequestPhoto.create({
      requestId,
      clientAccountId: req.clientAccountId,
      attachmentType: 'request_photo',
      storagePath: result.url,          // full Cloudinary URL
      originalName: result.originalName,
      mimeType: result.mimeType,
    });
    saved.push(photo);
  }
  return saved;
};


const saveDraft = async (req, res) => {
  try {
    const visibility = await getPriceVisibility(req, ClientAccount);
    const rawLocationId = fieldValue(req.body.locationId);
    const property = rawLocationId ? await findProperty(rawLocationId, req.clientAccountId) : null;
    if (rawLocationId && !property) {
      removeIncomingFiles(req);
      return res.status(400).json({ message: 'Choose an active property belonging to your client.' });
    }

    const rawPricingId = fieldValue(req.body.pricingId);
    let draftPricing = null;
    if (rawPricingId) {
      draftPricing = await PricingConfiguration.findOne({
        where: { id: rawPricingId, clientAccountId: req.clientAccountId, locationId: rawLocationId },
        include: [{ model: PricingPackage, as: 'package' }],
      });
      if (!draftPricing) {
        removeIncomingFiles(req);
        return res.status(400).json({ message: 'Choose a package configured for the selected property.' });
      }
    }

    const fields = getRequestFields(req.body, property);
    const values = {
      ...fields,
      partnerId: req.partner.id,
      submittedByUserId: req.partner.id,
      clientAccountId: req.clientAccountId,
      locationId: property?.id || null,
      packageType: draftPricing?.package?.key || 'draft',
      packageId: draftPricing?.packageId || null,
      packageNameSnapshot: draftPricing?.package?.name || null,
      serviceSnapshot: draftPricing?.service || null,
      itemSnapshot: draftPricing?.item || null,
      draftPricingId: draftPricing?.id || null,
      packagePrice: draftPricing ? Number(draftPricing.restorationPrice) : 0,
      restorationPrice: draftPricing ? Number(draftPricing.restorationPrice) : null,
      revenueShare: draftPricing ? Number(draftPricing.revenueShare) : null,
      invoiceAmount: draftPricing
        ? Number((Number(draftPricing.restorationPrice) - Number(draftPricing.revenueShare)).toFixed(2))
        : null,
      pricingEffectiveDate: draftPricing?.effectiveDate || null,
      status: assertInitialRequestStatus('DRAFT'),
    };

    let draft;
    if (req.params.id) {
      draft = await MemorialRequest.findOne({
        where: {
          id: req.params.id,
          partnerId: req.partner.id,
       submittedByUserId: req.partner.id,
          clientAccountId: req.clientAccountId,
          status: { [Op.in]: ADVISOR_EDITABLE_STATUSES },
        },
      });
      if (!canAdvisorEditRequest(draft, req.partner.id)) {
        removeIncomingFiles(req);
        return res.status(404).json({ message: 'Request not found or not editable.' });
      }
      const existingPhotoCount = await RequestPhoto.count({ where: { requestId: draft.id, clientAccountId: req.clientAccountId } });
      if (existingPhotoCount + (req.files?.length || 0) > 10) {
        removeIncomingFiles(req);
        return res.status(400).json({ message: 'A request can have up to 10 photos.' });
      }
      const [updatedCount] = await MemorialRequest.update(
        { ...values, status: draft.status },
        {
          where: {
            id: draft.id,
            partnerId: req.partner.id,
            clientAccountId: req.clientAccountId,
            status: draft.status,
          },
        }
      );
      if (!updatedCount) {
        removeIncomingFiles(req);
        return res.status(409).json({ message: 'Request status changed; refresh before editing.' });
      }
      draft = await MemorialRequest.findByPk(draft.id);
    } else {
      draft = await MemorialRequest.create(values);
    }
    await persistPhotos(req, draft.id);
    const savedDraft = await MemorialRequest.findByPk(draft.id, {
      include: [
        { model: RequestPhoto, as: 'photos', where: { clientAccountId: req.clientAccountId }, required: false },
        { model: PricingPackage, as: 'package' },
        { model: RequestStatusHistory, as: 'statusHistory', where: { clientAccountId: req.clientAccountId }, required: false },
      ],
    });
    return res.status(req.params.id ? 200 : 201).json({
      request: serializeWithPriceVisibility(savedDraft, visibility),
    });
  } catch (err) {
    removeIncomingFiles(req);
    return res.status(500).json({ message: 'Unable to save draft.' });
  }
};

const createRequest = async (req, res) => {
  try {
    const visibility = await getPriceVisibility(req, ClientAccount);
    const rawLocationId = fieldValue(req.body.locationId);
    const property = await findProperty(rawLocationId, req.clientAccountId);
    if (!property) {
      removeIncomingFiles(req);
      return res.status(400).json({ message: 'Choose an active property belonging to your client.' });
    }

    const fields = getRequestFields(req.body, property);
    const clientAccount = await ClientAccount.findByPk(req.clientAccountId, {
      attributes: ['requestPhotosRequired'],
    });
    let existingDraft = null;
    if (req.params.id) {
      existingDraft = await MemorialRequest.findOne({
        where: {
          id: req.params.id,
          partnerId: req.partner.id,
          clientAccountId: req.clientAccountId,
          status: { [Op.in]: ADVISOR_EDITABLE_STATUSES },
        },
      });
      if (!canAdvisorEditRequest(existingDraft, req.partner.id)) {
        removeIncomingFiles(req);
        return res.status(404).json({ message: 'Request not found or not editable.' });
      }
    }

    const existingPhotoCount = existingDraft
      ? await RequestPhoto.count({ where: { requestId: existingDraft.id, clientAccountId: req.clientAccountId } })
      : 0;
    const missing = validateSubmission({
      fields,
      locationId: rawLocationId,
      pricingId: req.body.pricingId,
      photosRequired: Boolean(clientAccount?.requestPhotosRequired),
      existingPhotoCount: existingPhotoCount + (req.files?.length || 0),
    });
    if (missing.length) {
      removeIncomingFiles(req);
      return res.status(400).json({ message: 'Complete all required fields before submitting.', fields: missing });
    }

    const pricing = await getCurrentPricing(req.body.pricingId, property.id, req.clientAccountId);
    if (!pricing) {
      removeIncomingFiles(req);
      return res.status(409).json({ message: 'No current price is configured for this property and package. Refresh and select a current package.' });
    }
    const restorationPrice = Number(pricing.restorationPrice);
    const revenueShare = Number(pricing.revenueShare);
    const invoiceAmount = Number((restorationPrice - revenueShare).toFixed(2));
    if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
      removeIncomingFiles(req);
      return res.status(409).json({ message: 'The configured price is invalid.' });
    }

    const submittedAt = new Date();
    const requestNumber = existingDraft?.requestNumber || await generateRequestNumber();
    if (existingDraft && existingDraft.status !== 'REJECTED') {
      assertRequestTransition(existingDraft.status, 'SUBMITTED');
    }
    const submissionValues = buildAdvisorSubmissionValues({
      request: existingDraft,
      advisorId: req.partner.id,
      generatedRequestNumber: requestNumber,
      submittedAt,
      values: {
      ...fields,
      partnerId: req.partner.id,
      clientAccountId: req.clientAccountId,
      locationId: property.id,
      packageType: pricing.package.key,
      packageId: pricing.packageId,
      packageNameSnapshot:
      pricing.package.name,
      serviceSnapshot: pricing.service || null,
      itemSnapshot: pricing.item || null,
      packagePrice: restorationPrice,
      restorationPrice,
      revenueShare,
      invoiceAmount,
      pricingEffectiveDate: pricing.effectiveDate,
      draftPricingId: null,
      },
    });
    if (!existingDraft) {
      submissionValues.status = assertInitialRequestStatus(submissionValues.status);
    }

    let memorialRequest;
    if (existingDraft) {
      const [updatedCount] = await MemorialRequest.update(
        submissionValues,
        {
          where: {
            id: existingDraft.id,
            partnerId: req.partner.id,
            clientAccountId: req.clientAccountId,
            status: existingDraft.status,
          },
        }
      );
      if (!updatedCount) {
        removeIncomingFiles(req);
        return res.status(409).json({ message: 'Request status changed; refresh before resubmitting.' });
      }
      memorialRequest = await MemorialRequest.findByPk(existingDraft.id);
    } else {
      memorialRequest = await MemorialRequest.create(submissionValues);
    }
    await persistPhotos(req, memorialRequest.id);
    await RequestStatusHistory.create({
      requestId: memorialRequest.id,
      clientAccountId: req.clientAccountId,
      fromStatus: existingDraft?.status || null,
      toStatus: 'SUBMITTED',
      changedByUserId: req.partner.id,
      changedByRole: req.userRole || req.partner.accountRole || 'family_advisor',
    });
    await recordRequestStatusAudit(
      AuditLog,
      req,
      memorialRequest,
      existingDraft?.status || null,
      'SUBMITTED',
      null,
    );

    const result = await MemorialRequest.findByPk(memorialRequest.id, {
      include: [
        { model: RequestPhoto, as: 'photos', where: { clientAccountId: req.clientAccountId }, required: false },
        { model: PricingPackage, as: 'package' },
        { model: RequestStatusHistory, as: 'statusHistory', where: { clientAccountId: req.clientAccountId }, required: false },
      ],
    });
    await notifyClientAdmins(result, req);

    // Fire-and-forget: an Airtable failure must never break the submission
    syncMemorialRequest(result).catch((e) =>
      console.error('[createRequest] Airtable sync:', e.message)
    );

    return res.status(existingDraft ? 200 : 201).json({
      request: serializeWithPriceVisibility(result, visibility),
    });
  } catch (err) {
    console.error('[createRequest]', err.message);
    removeIncomingFiles(req);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

const notifyClientAdmins = async (request, req) => {
  try {
    const recipients = await notificationRecipients.forRequestSubmitted(req.clientAccountId);
    const notifications = await notificationService.sendNotifications({
      type: NOTIFICATION_EVENTS.REQUEST_SUBMITTED,
      payload: {
        requestNumber: request.requestNumber,
        submittedAt: request.submittedAt,
        advisorName: req.partner.contactName || req.partner.username,
        customerName: request.customerName,
        memorialLocation: request.memorialLocation,
      },
    }, recipients);
    notifications.forEach((result) => {
      if (result.status === 'rejected') {
        console.error('[request notification] Client Admin delivery failed:', result.reason?.message || result.reason);
      }
    });
  } catch (error) {
    console.error('[request notification] Could not load Client Admin recipients:', error.message);
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
    const normalizedEmail = String(email || '').trim().toLowerCase();
 
    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Username is required.' });
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      return res.status(400).json({ message: 'A valid email address is required for login.' });
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
    if (normalizedEmail !== String(partner.email || '').toLowerCase()) {
      const existingEmail = await Partner.findOne({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        return res.status(409).json({ message: 'That email address is already in use.' });
      }
    }
 
    await partner.update({
      username: username.trim(),
      email: normalizedEmail,
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

module.exports = {
  getRequests,
  getRequest,
  getRequestOptions,
  getAvailablePricing,
  createRequest,
  saveDraft,
  uploadPhotos,
  getAccount,
  updateAccount,
  updatePassword,
};
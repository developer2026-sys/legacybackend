'use strict';

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  MonumentSettingRequest,
  MonumentSettingDocument,
  Partner,
  MemorialRequest,
} = require('../models');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'monument-setting');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/monument-setting/'),
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

/* ------------------------------------------------------------------ */
/* File upload config                                                  */
/* ASSUMPTION: adjust destination/storage to match however your        */
/* existing `uploadPhotos` (in controller/request.js) is configured    */
/* — e.g. swap this for your S3/cloud storage setup if that's what     */
/* you use for RequestPhoto.                                           */
/* ------------------------------------------------------------------ */


const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new Error('Only JPG, PNG, and PDF files are allowed.'));
};

const DOC_FIELDS = [
  { name: 'photoFront', maxCount: 1 },
  { name: 'photoBack', maxCount: 1 },
  { name: 'photoBase', maxCount: 1 },
  { name: 'drawing', maxCount: 1 },
  { name: 'plotInfo', maxCount: 1 },
  { name: 'foundationPhoto', maxCount: 1 },
  { name: 'cemeteryApprovalDoc', maxCount: 1 },
  { name: 'workOrder', maxCount: 1 },
  { name: 'additionalDocs', maxCount: 10 },
];

// map form field name -> documentType enum value stored in DB
const FIELD_TO_DOC_TYPE = {
  photoFront: 'monument_front_photo',
  photoBack: 'monument_back_photo',
  photoBase: 'base_photo',
  drawing: 'drawing_dimensions',
  plotInfo: 'cemetery_plot_info',
  foundationPhoto: 'foundation_photo',
  cemeteryApprovalDoc: 'cemetery_approval',
  workOrder: 'work_order',
  additionalDocs: 'additional',
};

const uploadMonumentDocs = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB each, matches your restoration flow
}).fields(DOC_FIELDS);

/* ------------------------------------------------------------------ */
/* Helper: generate MSR-000001 style request number                    */
/* ------------------------------------------------------------------ */
async function generateRequestNumber() {
  const last = await MonumentSettingRequest.findOne({
    order: [['id', 'DESC']],
  });
  const nextId = last ? last.id + 1 : 1;
  return `MSR-${String(nextId).padStart(6, '0')}`;
}

/* ------------------------------------------------------------------ */
/* POST /monument-setting/create-request                               */
/* ASSUMPTION: `authenticate` middleware sets req.partner (with .id)   */
/* — matches how your existing createRequest likely reads the partner. */
/* Adjust `req.partner.id` to `req.user.id` etc. if that's your shape. */
/* ------------------------------------------------------------------ */
const createMonumentSettingRequest = async (req, res) => {
  try {
    const partnerId = req.partner?.id;
    if (!partnerId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const b = req.body;

    const requestNumber = await generateRequestNumber();

    const newRequest = await MonumentSettingRequest.create({
      requestNumber,
      partnerId,

      partnerOrderNumber: b.partnerOrderNumber || null,
      internalReferenceNumber: b.internalReferenceNumber || null,

      familyFirstName: b.familyFirstName,
      familyLastName: b.familyLastName,
      familyPhone: b.familyPhone,
      familyEmail: b.familyEmail,
      familyAddress: b.familyAddress,
      familyCity: b.familyCity,
      familyState: b.familyState,
      familyZip: b.familyZip,
      preferredContact: (b.preferredContact || 'phone').toLowerCase(),
      allowFamilyContact: b.allowFamilyContact === 'true' || b.allowFamilyContact === true,

      cemeteryName: b.cemeteryName,
      cemeteryAddress: b.cemeteryAddress,
      cemeteryCity: b.cemeteryCity,
      cemeteryState: b.cemeteryState,
      territory: b.territory || null,
      cemeteryZip: b.cemeteryZip,
      cemeteryContactName: b.cemeteryContactName || null,
      cemeteryPhone: b.cemeteryPhone || null,
      cemeteryEmail: b.cemeteryEmail || null,
      section: b.section || null,
      lot: b.lot || null,
      block: b.block || null,
      graveSpace: b.graveSpace || null,
      cemeteryApproval: (b.cemeteryApproval || 'unknown').toLowerCase(),

      monumentType: normalizeEnum(b.monumentType),
      material: b.material || null,
      width: b.width || null,
      height: b.height || null,
      depth: b.depth || null,
      approximateWeight: b.weight || null,
      baseDimensions: b.baseDimensions || null,
      numberOfPieces: b.numPieces || null,
      settingRequested: normalizeEnum(b.settingRequested),

      monumentLocationType: normalizeEnum(b.monumentLocationType),
      pickupAddress: b.pickupAddress || null,
      pickupContactName: b.pickupContactName || null,
      pickupPhone: b.pickupPhone || null,
      readyForPickup: b.readyForPickup === 'Yes' || b.readyForPickup === true,
      requestedPickupDate: b.requestedPickupDate || null,

      requestedSettingDate: b.requestedSettingDate || null,
      alternateDate: b.alternateDate || null,
      deadlineDate: b.deadlineDate || null,
      flexibleDates: b.flexibleDates !== 'No',
      deadlineReason: normalizeEnum(b.deadlineReason),
      specialInstructions: b.specialInstructions || null,

      carePackageOption: b.carePackageOption || null,
      careFamilyStatus: normalizeCareStatus(b.careFamilyStatus),

      status: 'new',
    });

    // If a $549/$749 package was purchased, try to link to an existing
    // MemorialRequest/customer record by matching email — per spec point 9.
    if (b.careFamilyStatus === 'Purchased $549 Package' || b.careFamilyStatus === 'Purchased $749 Package') {
      const existingCustomer = await MemorialRequest.findOne({
        where: { customerEmail: b.familyEmail },
        order: [['id', 'DESC']],
      });
      if (existingCustomer) {
        newRequest.linkedMemorialRequestId = existingCustomer.id;
        await newRequest.save();
      }
    }

    // Save uploaded documents
    const files = req.files || {};
    const docRows = [];
    for (const fieldName of Object.keys(files)) {
      const docType = FIELD_TO_DOC_TYPE[fieldName] || 'additional';
      for (const file of files[fieldName]) {
        docRows.push({
          monumentSettingRequestId: newRequest.id,
          documentType: docType,
          storagePath: file.path,
        });
      }
    }
    if (docRows.length) {
      await MonumentSettingDocument.bulkCreate(docRows);
    }

    const full = await MonumentSettingRequest.findByPk(newRequest.id, {
      include: [{ model: MonumentSettingDocument, as: 'documents' }],
    });

    return res.status(201).json({ request: full });
  } catch (err) {
    console.error('createMonumentSettingRequest error:', err);
    return res.status(500).json({ message: err.message || 'Failed to create monument setting request.' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /monument-setting/  — list requests for the logged-in partner   */
/* ------------------------------------------------------------------ */
const getMonumentSettingRequests = async (req, res) => {
  try {
    const partnerId = req.partner?.id;
    if (!partnerId) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const requests = await MonumentSettingRequest.findAll({
      where: { partnerId },
      include: [{ model: MonumentSettingDocument, as: 'documents' }],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ requests });
  } catch (err) {
    console.error('getMonumentSettingRequests error:', err);
    return res.status(500).json({ message: 'Failed to fetch monument setting requests.' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /monument-setting/:id — single request, scoped to owning partner*/
/* ------------------------------------------------------------------ */
const getMonumentSettingRequest = async (req, res) => {
  try {
    const partnerId = req.partner?.id;
    const { id } = req.params;

    const request = await MonumentSettingRequest.findOne({
      where: { id, partnerId }, // scoping prevents cross-partner access
      include: [{ model: MonumentSettingDocument, as: 'documents' }],
    });

    if (!request) {
      return res.status(404).json({ message: 'Monument setting request not found.' });
    }

    return res.json({ request });
  } catch (err) {
    console.error('getMonumentSettingRequest error:', err);
    return res.status(500).json({ message: 'Failed to fetch monument setting request.' });
  }
};

/* ------------------------------------------------------------------ */
/* small normalizers: form sends "Upright" -> DB enum wants "upright"  */
/* ------------------------------------------------------------------ */
function normalizeEnum(value) {
  if (!value) return null;
  return String(value)
    .toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function normalizeCareStatus(value) {
  const map = {
    'Purchased $549 Package': 'purchased_549',
    'Purchased $749 Package': 'purchased_749',
    'Interested — Have Lasting Legacy Contact Them': 'interested_contact_them',
    'Information Requested': 'information_requested',
    'Declined': 'declined',
    'Not Discussed Yet': 'not_discussed_yet',
  };
  return map[value] || 'not_discussed_yet';
}

module.exports = {
  uploadMonumentDocs,
  createMonumentSettingRequest,
  getMonumentSettingRequests,
  getMonumentSettingRequest,
};
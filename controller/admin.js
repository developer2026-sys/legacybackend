'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { TeamMember } = require('../models');
const { seedDefaultsForNewAccount } = require('../services/seedNewAccountDefaults');
const fs = require('fs');
const teammember = require('../models/teammember');
const { changePartnerStatus } = require('../utils/userLifecycle');
const { Op } = require('sequelize');
const { syncTeamMemberStatus, syncMemorialRequest } = require('../airtable'); 
const { sendApInvoiceEmail } = require('../emailService'); 
const {
  REQUEST_STATUSES,
  transitionRequestRecord,
  getAllowedRequestTransitions,
} = require('../utils/requestStatus');
const emailService = require('../emailService');
const {
  NOTIFICATION_EVENTS,
  createNotificationService,
} = require('../services/notificationService');
const { createNotificationRecipients } = require('../services/notificationRecipients');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('/tmp/public/files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = path.basename(file.originalname || 'upload')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^\.+/, '') || 'upload';
    cb(null, `${Date.now()}-${safeOriginalName}`);
  },
});
const upload = multer({ storage });

const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[AdminController]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = (models) => {
  const {
    Admin,
    Partner,
    MemorialRequest,
    RequestStatusHistory,
    AuditLog,
    RequestPhoto,
    PartnerTeamMember,
    PartnershipSettings,
    ClientAccount,
    Location,
    UserStatusLog,
    PricingPackage,
    Invoice,
    InvoicePaymentAudit,
    ApprovalEvent,
    Payment,
    WorkOrder,
    Schedule,
    MonumentSettingRequest,
    MonumentSettingDocument,
    MonumentSettingStatusHistory,
  } = models;
  const requestOperations = require('./requestOperations')(models);
  const { recordRequestStatusAudit } = require('../utils/requestAudit');
  const notificationService = createNotificationService({ channels: { email: emailService } });
  const notificationRecipients = createNotificationRecipients({ Partner, ClientAccount, Op });
  const notifyAdvisorOfRequestStatus = async (request, status, reason) => {
    try {
      const recipients = await notificationRecipients.forRequestStatusChanged(request);
      const results = await notificationService.sendNotifications({
        type: NOTIFICATION_EVENTS.REQUEST_STATUS_CHANGED,
        payload: {
          requestNumber: request.requestNumber || `#${request.id}`,
          customerName: request.customerName,
          propertyName: request.location?.name || request.memorialLocation,
          status,
          reason,
        },
      }, recipients);
      results.forEach((result) => {
        if (result.status === 'rejected') {
          console.error('[request status notification] Advisor delivery failed:', result.reason?.message || result.reason);
        }
      });
    } catch (error) {
      // Delivery failures should not undo a recorded administrative decision.
      console.error('[request status notification] Could not load recipients:', error.message);
    }
  };
  // ── AUTH ──────────────────────────────────────────────────────────────────

  // const register = safe(async (req, res) => {
  //   const { email, password } = req.body;
  //   if (!email || !password)
  //     return res.status(400).json({ message: 'Email and password are required.' });

  //   const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  //   const suppliedSecret = req.get('x-admin-bootstrap-key') || '';
  //   if (!bootstrapSecret) {
  //     return res.status(503).json({ message: 'Admin bootstrap is not configured.' });
  //   }
  //   const suppliedBytes = Buffer.from(suppliedSecret);
  //   const expectedBytes = Buffer.from(bootstrapSecret);
  //   if (
  //     suppliedBytes.length !== expectedBytes.length
  //     || !crypto.timingSafeEqual(suppliedBytes, expectedBytes)
  //   ) {
  //     return res.status(403).json({ message: 'A valid admin bootstrap key is required.' });
  //   }

  //   // Registration is a one-time bootstrap flow. Once a platform admin
  //   // exists, creating another super_admin must require an authenticated
  //   // administrative workflow instead of being publicly reachable.
  //   if (await Admin.count()) {
  //     return res.status(403).json({ message: 'Admin registration is disabled.' });
  //   }

  //   const exists = await Admin.findOne({ where: { email } });
  //   if (exists)
  //     return res.status(409).json({ message: 'An admin with that email already exists.' });

  //   const hashed = await bcrypt.hash(password, 12);
  //   const admin = await Admin.create({ email, password: hashed, role: 'super_admin' });

  //   res.status(201).json({ message: 'Admin account created.', admin: { id: admin.id, email: admin.email } });
  // });

  const register = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });
  
    if (await Admin.count()) {
      return res.status(403).json({ message: 'Admin registration is disabled.' });
    }
    
    const hashed = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ email, password: hashed, role: 'super_admin' });
  
    res.status(201).json({ message: 'Admin account created.', admin: { id: admin.id, email: admin.email } });
  });
  const login = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials.' });

    const teamMembership = await TeamMember.findOne({ where: { admin_id: admin.id } });
    if (teamMembership) {
      return res.status(403).json({ message: 'This account is not authorized for Super Admin access.' });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role || 'super_admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      admin: { id: admin.id, email: admin.email, role: admin.role || 'super_admin' },
    });
  });

  const resetPassword = safe(async (req, res) => {
    const { email, newPassword } = req.body;
  
    if (!email || !newPassword) {
      return res.status(400).json({ message: 'Email and new password are required.' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }
  
    const normalizedEmail = String(email).trim().toLowerCase();
    const admin = await Admin.findOne({ where: { email: normalizedEmail } });
    if (!admin) {
      return res.status(404).json({ message: 'No admin account found with that email.' });
    }
  
    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();
  
    res.json({ message: 'Password updated successfully.' });
  });

  // ── PARTNERS ──────────────────────────────────────────────────────────────

  const getAllPartners = safe(async (req, res) => {
    const partners = await Partner.findAll({
      attributes: ['id', 'username', 'email', 'role', 'accountRole', 'status', 'createdAt', 'updatedAt'],
      include: [{
        model: PartnershipSettings,
        as: 'partnershipSettings',
        attributes: ['emailRemindersEnabled'],
      }],
      order: [['created_at', 'DESC']],
    });
    res.json({ partners });
  });

  const getAllClientAccounts = safe(async (req, res) => {
    const accounts = await ClientAccount.findAll({
      include: [
        { model: Location, as: 'locations' },
        { model: Partner, as: 'members', attributes: ['id', 'username', 'email', 'accountRole', 'status'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ accounts });
  });

  const getClientAccount = safe(async (req, res) => {
    const account = await ClientAccount.findByPk(req.params.id, {
      include: [
        { model: Location, as: 'locations' },
        { model: Partner, as: 'members', attributes: ['id', 'username', 'email', 'accountRole', 'status'] },
      ],
    });
    if (!account) return res.status(404).json({ message: 'Client account not found.' });
    res.json({ account });
  });

  const createClientAccount = safe(async (req, res) => {
    const { name, accountType = 'client', parentClientAccountId } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Client account name is required.' });
    }
    if (parentClientAccountId && !(await ClientAccount.findByPk(parentClientAccountId))) {
      return res.status(400).json({ message: 'Parent client account not found.' });
    }
    const base = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let slug = base || 'client-account';
    let suffix = 2;
    while (await ClientAccount.findOne({ where: { slug } })) slug = `${base || 'client-account'}-${suffix++}`;
  //   const account = await ClientAccount.create({
  //     name: String(name).trim(),
  //     slug,
  //     accountType: accountType === 'master' ? 'master' : 'client',
  //     parentClientAccountId: parentClientAccountId || null,
  //     status: 'active',
  //   });
  //   res.status(201).json({ account });
  // });

  const account = await ClientAccount.create({
    name: String(name).trim(),
    slug,
    accountType: accountType === 'master' ? 'master' : 'client',
    parentClientAccountId: parentClientAccountId || null,
    status: 'active',
  });
  await seedDefaultsForNewAccount(account.id);
  await Location.bulkCreate(
    DEFAULT_LOCATIONS.map((loc) => ({
      clientAccountId: account.id,
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      status: 'active',
    }))
  );
  res.status(201).json({ account });
});
  const createClientLocation = safe(async (req, res) => {
    const account = await ClientAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ message: 'Client account not found.' });
    const { name, address, city, state, zip } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Location name is required.' });
    }
    const location = await Location.create({
      clientAccountId: account.id,
      name: String(name).trim(),
      address: address || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      status: 'active',
    });
    res.status(201).json({ location });
  });

  const updateClientRequestSettings = safe(async (req, res) => {
    const { requestPhotosRequired } = req.body;
    if (typeof requestPhotosRequired !== 'boolean') {
      return res.status(400).json({ message: 'requestPhotosRequired must be a boolean.' });
    }
    const account = await ClientAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ message: 'Client account not found.' });
    await account.update({ requestPhotosRequired });
    return res.json({ requestPhotosRequired: account.requestPhotosRequired });
  });

  const updateClientAccountsPayable = safe(async (req, res) => {
    const rawEmail = req.body?.accountsPayableEmail;
    if (rawEmail !== null && rawEmail !== undefined && typeof rawEmail !== 'string') {
      return res.status(400).json({ message: 'accountsPayableEmail must be a valid email address or empty.' });
    }
    const accountsPayableEmail = String(rawEmail || '').trim().toLowerCase();
    if (accountsPayableEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountsPayableEmail)) {
      return res.status(400).json({ message: 'Enter a valid accounts-payable email address.' });
    }
    const account = await ClientAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ message: 'Client account not found.' });
    await account.update({ accountsPayableEmail: accountsPayableEmail || null });
    return res.json({ accountsPayableEmail: account.accountsPayableEmail });
  });

  const updateClientPriceVisibility = safe(async (req, res) => {
    const allowed = ['none', 'customer_retail', 'restoration'];
    const {
      familyAdvisorPriceVisibility,
      clientAdminPriceVisibility,
    } = req.body || {};
    const updates = {};

    if (familyAdvisorPriceVisibility !== undefined) {
      if (!allowed.includes(familyAdvisorPriceVisibility)) {
        return res.status(400).json({
          message: 'familyAdvisorPriceVisibility must be none, customer_retail, or restoration.',
        });
      }
      updates.familyAdvisorPriceVisibility = familyAdvisorPriceVisibility;
    }
    if (clientAdminPriceVisibility !== undefined) {
      if (!allowed.includes(clientAdminPriceVisibility)) {
        return res.status(400).json({
          message: 'clientAdminPriceVisibility must be none, customer_retail, or restoration.',
        });
      }
      updates.clientAdminPriceVisibility = clientAdminPriceVisibility;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Provide at least one price visibility setting.' });
    }

    const account = await ClientAccount.findByPk(req.params.id);
    if (!account) return res.status(404).json({ message: 'Client account not found.' });
    await account.update(updates);
    return res.json({
      familyAdvisorPriceVisibility: account.familyAdvisorPriceVisibility,
      clientAdminPriceVisibility: account.clientAdminPriceVisibility,
    });
  });


  const getPartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id, {
       attributes: ['id', 'username', 'email', 'role', 'accountRole', 'status', 'createdAt', 'updatedAt'],
      include: [{
        model: MemorialRequest,
        as: 'requests',
        attributes: ['id', 'packageType', 'packagePrice', 'customerName', 'status', 'createdAt'],
      }],
    });
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    res.json({ partner });
  });

  const updatePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });

    const { username, email, role, password } = req.body;
    if (username !== undefined) partner.username = username;
    if (email !== undefined) partner.email = email;
    if (role !== undefined) {
      if (!['partner', 'admin'].includes(role))
        return res.status(400).json({ message: "Role must be 'partner' or 'admin'." });
      partner.role = role;
    }
    if (password) {
      partner.password = await bcrypt.hash(password, 12);
      if (partner.accountRole === 'family_advisor') {
        partner.mustChangePassword = true;
      }
    }
    await partner.save();

    res.json({ message: 'Partner updated.', partner: { id: partner.id, username: partner.username, email: partner.email, role: partner.role } });
  });

  const deletePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    await changePartnerStatus({
      partner,
      newStatus: 'inactive',
      UserStatusLog,
      changedByType: 'super_admin',
      changedById: req.admin.id,
      reason: req.body?.reason || 'Removed by Super Admin.',
    });
    res.json({ message: 'Partner deactivated. User records and requests were retained.' });
  });

  const setPartnerStatus = safe(async (req, res) => {
    const { status, reason } = req.body;
    if (!['suspended', 'inactive', 'active'].includes(status)) {
      return res.status(400).json({ message: 'Super Admin may directly set only active, suspended, or inactive.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reason is required.' });
    }

    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });

    await changePartnerStatus({
      partner,
      newStatus: status,
      UserStatusLog,
      changedByType: 'super_admin',
      changedById: req.admin.id,
      reason: String(reason).trim(),
    });

    res.json({ message: 'Partner status updated.', partner: { id: partner.id, status: partner.status } });
  });

  const approvePartnerActivation = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    if (partner.status !== 'pending_approval') {
      return res.status(409).json({ message: 'Only pending users can be activated.' });
    }

    await changePartnerStatus({
      partner,
      newStatus: 'active',
      UserStatusLog,
      changedByType: 'super_admin',
      changedById: req.admin.id,
      reason: req.body?.reason || 'Activation approved by Super Admin.',
    });

    res.json({ message: 'Partner activated.', partner: { id: partner.id, status: partner.status } });
  });

  // ── REQUESTS ──────────────────────────────────────────────────────────────

  const getPaymentConfirmationQueue = safe(async (_req, res) => {
    const invoices = await Invoice.findAll({
      where: { paymentStatus: 'PENDING' },
      include: [{
        model: MemorialRequest,
        as: 'memorialRequest',
        required: true,
        where: { status: { [Op.in]: ['INVOICE_PENDING', 'PAYMENT_PENDING'] } },
        include: [
          { model: ClientAccount, as: 'clientAccount', attributes: ['id', 'name'] },
          { model: Location, as: 'location', attributes: ['id', 'name'] },
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email', 'accountRole'] },
        ],
      }],
      order: [['created_at', 'ASC']],
    });
    res.json({ invoices });
  });

  const confirmInvoicePayment = safe(async (req, res) => {
    if (!Invoice || !InvoicePaymentAudit) {
      return res.status(503).json({ message: 'Invoice payment confirmation is not configured.' });
    }

    const result = await Invoice.sequelize.transaction(async (transaction) => {
      const invoice = await Invoice.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!invoice) return { statusCode: 404, message: 'Invoice not found.' };
      if (invoice.paymentStatus === 'PAID') {
        return { statusCode: 409, message: 'Payment has already been confirmed.' };
      }
      if (invoice.paymentStatus !== 'PENDING') {
        return { statusCode: 409, message: 'Only pending invoices can be confirmed.' };
      }

      const request = await MemorialRequest.findByPk(invoice.requestId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!request) return { statusCode: 409, message: 'The invoice has no linked request.' };
      if (!['INVOICE_PENDING', 'PAYMENT_PENDING'].includes(request.status)) {
        return { statusCode: 409, message: 'The linked request is not awaiting payment.' };
      }

      const previousStatus = request.status;
      const newStatus = 'PENDING_SCHEDULING';
      const paidAt = new Date();
      transitionRequestRecord(request, newStatus, { paymentConfirmed: true });

      invoice.paymentStatus = 'PAID';
      invoice.paidDate = paidAt.toISOString().slice(0, 10);
      invoice.paidTime = paidAt.toISOString().slice(11, 19);
      await invoice.save({ transaction });
      await request.save({ transaction });

      const historyEntry = await RequestStatusHistory.create({
        requestId: request.id,
        clientAccountId: request.clientAccountId,
        fromStatus: previousStatus,
        toStatus: newStatus,
        reason: 'Payment manually confirmed by Super Admin.',
        changedByUserId: req.admin.id,
        changedByRole: req.admin.role,
      }, { transaction });
      await recordRequestStatusAudit(
        AuditLog,
        req,
        request,
        previousStatus,
        newStatus,
        'Payment manually confirmed by Super Admin.',
        { transaction },
      );
      const auditEvent = await InvoicePaymentAudit.create({
        invoiceId: invoice.id,
        userId: req.admin.id,
        role: req.admin.role,
        clientAccountId: request.clientAccountId,
        requestId: request.id,
        previousStatus,
        newStatus,
        previousPaymentStatus: 'PENDING',
        newPaymentStatus: 'PAID',
        timestamp: paidAt,
      }, { transaction });
      const payment = Payment?.create
        ? await Payment.create({
          requestId: request.id,
          invoiceId: invoice.id,
          clientAccountId: request.clientAccountId,
          amount: invoice.amount || 0,
          status: 'CONFIRMED',
          method: 'manual_confirmation',
          confirmedAt: paidAt,
          confirmedByUserId: req.admin.id,
          paymentAuditId: auditEvent.id,
        }, { transaction })
        : null;
      const workOrder = WorkOrder?.findOrCreate
        ? (await WorkOrder.findOrCreate({
          where: { requestId: request.id },
          defaults: {
            requestId: request.id,
            clientAccountId: request.clientAccountId,
            workOrderNumber: `WO-${request.requestNumber || request.id}`,
            status: 'PENDING',
          },
          transaction,
        }))[0]
        : null;

      return { invoice, request, historyEntry, auditEvent, payment, workOrder };
    });

    if (result.statusCode) {
      return res.status(result.statusCode).json({ message: result.message });
    }
    await notifyAdvisorOfRequestStatus(
      result.request,
      result.request.status,
      'Payment manually confirmed by Super Admin.',
    );
    syncMemorialRequest(result.request).catch((e) =>
      console.error('[confirmInvoicePayment] Airtable sync:', e.message)
    );

    // Send invoice email. A mail failure must NOT undo a committed payment.
    let invoiceEmailSent = false;
    try {
      const r = result.request;
      const inv = result.invoice;

      const advisor = r.submittedByUserId && Partner?.findByPk
        ? await Partner.findByPk(r.submittedByUserId)
        : null;

        const photos = typeof r.getPhotos === 'function' ? await r.getPhotos() : [];
        const location = r.locationId && typeof r.getLocation === 'function'
          ? await r.getLocation()
          : null;
      const photoUrl = (type) => {
        const p = photos.find((x) => x.attachmentType === type);
        return p ? p.storagePath : undefined; // convert to public URL if needed
      };

      await sendApInvoiceEmail({
        recipientEmail: process.env.AP_INVOICE_EMAIL,
        invoiceId: inv.id,
        requestNumber: r.requestNumber || r.id,
        customerName: r.customerName,
        customerEmail: r.customerEmail,
        customerPhone: r.customerPhone,
        propertyName: r.cemeteryName || location?.name || r.memorialLocation,
        memorialLocation: r.memorialLocation,
        advisorName: advisor?.contactName || advisor?.username,
        amount: inv.amount ?? r.invoiceAmount,
        status:"due",
        createdAt: inv.createdAt,
        paidAt: new Date(`${inv.paidDate}T${inv.paidTime}Z`),
        paymentMethod: 'Manual confirmation',
        dueDate: inv.dueDate,
        notes: r.notes,
        adminNotes: r.adminNotes,
        packageName: r.packageNameSnapshot || r.packageType,
        restorationTotal: r.restorationPrice,
        revenueShareTotal: r.revenueShare,
        pricingEffectiveDate: r.pricingEffectiveDate,
        nameOnMemorial: r.nameOnMemorial,
        memorialSize: r.memorialSize,
        memorialType: r.memorialType,
        cemeteryName: r.cemeteryName,
        section: r.section,
        lot: r.lot,
        space: r.space,
        vaseInfo: r.vaseInfo,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt,
        lineItems: inv.lineItems || [{
          description: r.packageNameSnapshot || r.packageType,
          quantity: 1,
          unitPrice: inv.amount ?? r.invoiceAmount,
        }],
        beforePhotoUrl: photoUrl('before'),
        afterPhotoUrl: photoUrl('after'),
      });
      invoiceEmailSent = true;
      console.log('[confirmInvoicePayment] Invoice email sent for invoice', inv.id);
    } catch (e) {
      console.error('[confirmInvoicePayment] Invoice email:', e.message);
    }

    return res.json({
      message: 'Payment confirmed.',
      invoiceEmailSent,
      invoice: result.invoice,
      payment: result.payment,
      workOrder: result.workOrder,
      request: {
        id: result.request.id,
        status: result.request.status,
        statusHistory: [result.historyEntry],
      },
      auditEvent: result.auditEvent,
    });
  });

  const getAllRequests = safe(async (req, res) => {
    const where = { status: { [Op.ne]: 'DRAFT' } };
    const positiveId = (value) => /^[1-9]\d*$/.test(String(value || ''));
    if (req.query.clientId && positiveId(req.query.clientId)) where.clientAccountId = Number(req.query.clientId);
    if (req.query.propertyId && positiveId(req.query.propertyId)) where.locationId = Number(req.query.propertyId);
    if (req.query.userId && positiveId(req.query.userId)) where.submittedByUserId = Number(req.query.userId);
    if (req.query.status && REQUEST_STATUSES.includes(String(req.query.status))) where.status = req.query.status;
    const submittedAt = {};
    if (req.query.fromDate) submittedAt[Op.gte] = new Date(`${req.query.fromDate}T00:00:00.000Z`);
    if (req.query.toDate) submittedAt[Op.lte] = new Date(`${req.query.toDate}T23:59:59.999Z`);
    if (Object.keys(submittedAt).length) where.submittedAt = submittedAt;

    const requests = await MemorialRequest.findAll({
      where,
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email', 'accountRole'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath', 'attachmentType', 'originalName', 'mimeType', 'createdAt'] },
        { model: PricingPackage, as: 'package', attributes: ['id', 'name', 'key'] },
        { model: ClientAccount, as: 'clientAccount', attributes: ['id', 'name'] },
        { model: Location, as: 'location', attributes: ['id', 'name'] },
        { model: RequestStatusHistory, as: 'statusHistory' },
        ...(ApprovalEvent ? [{ model: ApprovalEvent, as: 'approvalEvents' }] : []),
        ...(WorkOrder ? [{
          model: WorkOrder,
          as: 'workOrder',
          include: Schedule ? [{ model: Schedule, as: 'schedules' }] : [],
        }] : []),
        ...(Invoice ? [{
          model: Invoice,
          as: 'invoice',
          required: Boolean(req.query.invoiceStatus || req.query.paymentStatus),
          ...(req.query.invoiceStatus || req.query.paymentStatus
            ? {
              where: {
                ...(req.query.invoiceStatus ? { status: req.query.invoiceStatus } : {}),
                ...(req.query.paymentStatus ? { paymentStatus: req.query.paymentStatus } : {}),
              },
            }
            : {}),
        }] : []),
      ],
      order: [['created_at', 'DESC']],
    });
    const serviceType = String(req.query.serviceType || '').trim().toLowerCase();
    const filtered = serviceType
      ? requests.filter((request) => String(request.packageType || request.packageNameSnapshot || '').toLowerCase().includes(serviceType))
      : requests;
    res.json({ requests: filtered });
  });

  const getAuditTrail = safe(async (req, res) => {
    const where = {};
    for (const field of ['clientId', 'propertyId', 'userId', 'requestId']) {
      const value = req.query[field];
      if (value === undefined) continue;
      if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
        return res.status(400).json({ message: `${field} must be a positive integer.` });
      }
      where[field] = Number(value);
    }
    if (req.query.action !== undefined) {
      const action = String(req.query.action).trim();
      if (!action || action.length > 64) {
        return res.status(400).json({ message: 'action must contain 1 to 64 characters.' });
      }
      where.action = action;
    }

    const rawStartDate = req.query.startDate ?? req.query.from;
    const rawEndDate = req.query.endDate ?? req.query.to;
    const parseDate = (value, endOfDay = false) => {
      if (value === undefined) return undefined;
      const text = String(value);
      const date = new Date(
        endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(text)
          ? `${text}T23:59:59.999Z`
          : text,
      );
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const startDate = parseDate(rawStartDate);
    const endDate = parseDate(rawEndDate, true);
    if (startDate === null || endDate === null) {
      return res.status(400).json({ message: 'Date filters must be valid dates.' });
    }
    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ message: 'startDate must be earlier than or equal to endDate.' });
    }
    if (startDate || endDate) {
      where.timestamp = {
        ...(startDate ? { [Op.gte]: startDate } : {}),
        ...(endDate ? { [Op.lte]: endDate } : {}),
      };
    }

    const parsePagination = (value, fallback, minimum) => {
      if (value === undefined) return fallback;
      if (!/^\d+$/.test(String(value))) return null;
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
    };
    const limit = parsePagination(req.query.limit, 50, 1);
    const offset = parsePagination(req.query.offset, 0, 0);
    if (limit === null || offset === null) {
      return res.status(400).json({ message: 'limit and offset must be non-negative integers; limit must be at least 1.' });
    }

    const pageSize = Math.min(limit, 100);
    const result = await AuditLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
    });
    return res.json({
      auditTrail: result.rows,
      pagination: {
        total: result.count,
        limit: pageSize,
        offset,
      },
    });
  });

  const getRequest = safe(async (req, res) => {
    const request = await MemorialRequest.findByPk(req.params.id, {
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email', 'accountRole'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath', 'attachmentType', 'originalName', 'mimeType', 'createdAt'] },
        { model: PricingPackage, as: 'package', attributes: ['id', 'name', 'key'] },
        { model: ClientAccount, as: 'clientAccount', attributes: ['id', 'name'] },
        { model: Location, as: 'location', attributes: ['id', 'name'] },
        { model: RequestStatusHistory, as: 'statusHistory' },
        ...(Invoice ? [{
          model: Invoice,
          as: 'invoice',
          include: InvoicePaymentAudit ? [{
            model: InvoicePaymentAudit,
            as: 'paymentAudit',
            attributes: ['id', 'newPaymentStatus', 'timestamp'],
          }] : [],
        }] : []),
        ...(Payment ? [{
          model: Payment,
          as: 'payments',
          attributes: ['id', 'amount', 'status', 'method', 'confirmedAt', 'confirmedByUserId'],
        }] : []),
        ...(ApprovalEvent ? [{
          model: ApprovalEvent,
          as: 'approvalEvents',
        }] : []),
        ...(WorkOrder ? [{
          model: WorkOrder,
          as: 'workOrder',
          include: Schedule ? [{ model: Schedule, as: 'schedules' }] : [],
        }] : []),
        ...(MonumentSettingRequest ? [{
          model: MonumentSettingRequest,
          as: 'settingRequests',
          include: [
            { model: MonumentSettingDocument, as: 'documents' },
            { model: MonumentSettingStatusHistory, as: 'statusHistory' },
          ],
        }] : []),
      ],
    });
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    res.json({ request });
  });

  const markRequestUnderReview = safe(async (req, res) => {
    const request = await MemorialRequest.findByPk(req.params.id, {
      include: [{ model: Location, as: 'location', attributes: ['id', 'name'] }],
    });
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.status === 'UNDER_REVIEW') {
      return res.json({ message: 'Request is already under review.', request: { id: request.id, status: request.status } });
    }
    if (request.status !== 'SUBMITTED') {
      return res.status(409).json({ message: 'Only submitted requests can be opened for review.' });
    }

    const previousStatus = request.status;
    transitionRequestRecord(request, 'UNDER_REVIEW');
    await request.save();
    const historyEntry = await RequestStatusHistory.create({
      requestId: request.id,
      clientAccountId: request.clientAccountId,
      fromStatus: previousStatus,
      toStatus: 'UNDER_REVIEW',
      reason: null,
      changedByUserId: req.admin.id,
      changedByRole: req.admin.role,
    });
    await recordRequestStatusAudit(
      AuditLog,
      req,
      request,
      previousStatus,
      'UNDER_REVIEW',
      null,
    );
    await notifyAdvisorOfRequestStatus(request, 'UNDER_REVIEW', null);
    syncMemorialRequest(request).catch((e) =>
      console.error('[markRequestUnderReview] Airtable sync:', e.message)
    );


    return res.json({
      message: 'Request opened for review.',
      request: { id: request.id, status: request.status, statusHistory: [historyEntry] },
    });
  });

  const updateRequestStatus = safe(async (req, res) => {
    const { status } = req.body;
    const reasonValue = req.body?.reason ?? req.body?.adminNotes;
    const reason = typeof reasonValue === 'string' ? reasonValue.trim() : '';
    if (!REQUEST_STATUSES.includes(status))
      return res.status(400).json({ message: `status must be one of: ${REQUEST_STATUSES.join(', ')}.` });
    if (['REJECTED', 'NEEDS_INFORMATION'].includes(status) && !reason) {
      return res.status(400).json({
        message: status === 'REJECTED' ? 'A denial reason is required.' : 'A note is required to request more information.',
      });
    }

    const request = await MemorialRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (status === 'COMPLETED') {
      const order = WorkOrder ? await WorkOrder.findOne({ where: { requestId: request.id } }) : null;
      const photos = RequestPhoto ? await RequestPhoto.findAll({ where: { requestId: request.id } }) : [];
      const checklist = order?.completionChecklist || {};
      const missing = [];
      if (!photos.some((photo) => photo.attachmentType === 'before_photo')) missing.push('before photo');
      if (!photos.some((photo) => photo.attachmentType === 'after_photo')) missing.push('after photo');
      if (!order?.serviceNotes) missing.push('service notes');
      if (!order?.assignedTechnicianName) missing.push('technician/provider');
      if (!order?.completionDetails) missing.push('completion details');
      if (!Object.keys(checklist).length || Object.values(checklist).some((item) => !item)) missing.push('completion checklist');
      if (missing.length) {
        return res.status(400).json({ message: `Completion requires ${missing.join(', ')}.`, missing });
      }
    }

    const requestedStatuses = status === 'APPROVED'
      ? ['APPROVED', 'INVOICE_PENDING']
      : [status];
    const historyEntries = [];
    try {
      for (const nextStatus of requestedStatuses) {
        const previousStatus = request.status;
        transitionRequestRecord(request, nextStatus);
        if (previousStatus !== nextStatus) {
          historyEntries.push({
            requestId: request.id,
            clientAccountId: request.clientAccountId,
            fromStatus: previousStatus,
            toStatus: nextStatus,
            reason: reason || null,
            changedByUserId: req.admin.id,
            changedByRole: req.admin.role,
          });
        }
      }
    } catch (error) {
      return res.status(409).json({
        message: error.message,
        allowedTransitions: getAllowedRequestTransitions(request.status),
      });
    }

    if (reasonValue !== undefined) request.adminNotes = reason;
    if (status === 'APPROVED') {
      request.approvedBy = req.admin.email;
      request.approvedAt = new Date();
      request.deniedBy = null;
      request.deniedAt = null;
    } else if (status === 'REJECTED') {
      request.deniedBy = req.admin.email;
      request.deniedAt = new Date();
      request.approvedBy = null;
      request.approvedAt = null;
    }

    await request.save();
    const savedHistory = [];
    for (const entry of historyEntries) {
      savedHistory.push(await RequestStatusHistory.create(entry));
      await recordRequestStatusAudit(
        AuditLog,
        req,
        request,
        entry.fromStatus,
        entry.toStatus,
        entry.reason,
      );
    }
    const approvalEventType = {
      APPROVED: 'approved',
      REJECTED: 'rejected',
      NEEDS_INFORMATION: 'information_requested',
    }[status];
    if (approvalEventType && ApprovalEvent?.create) {
      await ApprovalEvent.create({
        requestId: request.id,
        clientAccountId: request.clientAccountId,
        eventType: approvalEventType,
        actorUserId: req.admin.id,
        actorRole: req.admin.role || 'super_admin',
        actorName: req.admin.email || null,
        notes: reason || null,
        metadata: { fromStatus: historyEntries[0]?.fromStatus || null },
      });
    }
    if (
      ['INVOICE_PENDING', 'PAYMENT_PENDING'].includes(request.status)
      && Invoice?.findOrCreate
    ) {
      const clientAccount = request.clientAccountId
        ? await ClientAccount.findByPk(request.clientAccountId)
        : null;
      const [invoice, invoiceCreated] = await Invoice.findOrCreate({
        where: { requestId: request.id },
        defaults: {
          requestId: request.id,
          clientAccountId: request.clientAccountId,
          amount: request.invoiceAmount ?? request.packagePrice,
          customerRetailAmount: request.packagePrice,
          restorationAmount: request.restorationPrice,
          revenueShareAmount: request.revenueShare,
          pricingEffectiveDate: request.pricingEffectiveDate,
          pricingSnapshot: {
            packageId: request.packageId,
            packageName: request.packageNameSnapshot,
            customerRetailAmount: request.packagePrice,
            restorationAmount: request.restorationPrice,
            revenueShareAmount: request.revenueShare,
            invoiceAmount: request.invoiceAmount ?? request.packagePrice,
            effectiveDate: request.pricingEffectiveDate,
          },
          invoiceNumber: `INV-${request.requestNumber || request.id}`,
          issuedAt: new Date(),
          accountsPayableEmail: clientAccount?.accountsPayableEmail || null,
          locationId: request.locationId,
          packageId: request.packageId,
          status: 'SENT',
          paymentStatus: 'PENDING',
        },
      });
      if (invoiceCreated && request.clientAccountId) {
        if (clientAccount?.accountsPayableEmail) {
          try {
            const invoiceRecipients = await notificationRecipients.forInvoiceCreated(request.clientAccountId);

            // Advisor isn't loaded on `request` here, so look it up
            const advisor = request.partner
              || (request.partnerId && Partner?.findByPk
                ? await Partner.findByPk(request.partnerId)
                : null);

            const invoiceNotifications = await notificationService.sendNotifications({
              type: NOTIFICATION_EVENTS.INVOICE_CREATED,
              payload: {
                invoiceId: invoice.id,
                requestNumber: request.requestNumber || `#${request.id}`,
                status: invoice.paymentStatus || 'PENDING',
                customerName: request.customerName,
                customerEmail: request.customerEmail,
                customerPhone: request.customerPhone,
                propertyName: request.location?.name || request.memorialLocation,
                memorialLocation: request.memorialLocation,
                advisorName: advisor?.contactName || advisor?.username || advisor?.email,
                packageName: request.packageNameSnapshot || request.package?.name || request.packageType,
                amount: invoice.amount,
                createdAt: invoice.issuedAt || invoice.createdAt,
                notes: request.notes,
                restorationTotal: request.restorationPrice,
                revenueShareTotal: request.revenueShare,
              },
            }, invoiceRecipients);
            invoiceNotifications.forEach((result) => {
              if (result.status === 'rejected') {
                console.error('[AP invoice notification] Delivery failed:', result.reason?.message || result.reason);
              }
            });
          } catch (error) {
            console.error('[AP invoice notification] Could not load recipients:', error.message);
          }
        }
      }
    }
    for (const entry of historyEntries) {
      await notifyAdvisorOfRequestStatus(request, entry.toStatus, entry.reason);
    }
  syncMemorialRequest(request).catch((e) =>
      console.error('[updateRequestStatus] Airtable sync:', e.message)
    );
    res.json({
      message: 'Status updated.',
      request: {
        id:         request.id,
        status:     request.status,
        adminNotes: request.adminNotes,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt,
        deniedBy:   request.deniedBy,
        deniedAt:   request.deniedAt,
        allowedTransitions: getAllowedRequestTransitions(request.status),
        statusHistory: savedHistory,
      },
    });
  });


  // ── DOCUMENTS — must be an array, NOT wrapped in safe() ──────────────────

  const uploadDocuments = [
    upload.array('documents'),
    async (req, res) => {
      try {
        console.log('[uploadDocuments] called, files:', req.files?.length);
  
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: 'No files received.' });
        }
  
        const { id } = req.params;
  
        const request = await MemorialRequest.findByPk(id);
        if (!request) {
          return res.status(404).json({ message: 'Request not found.' });
        }
  
        // ← this part was missing from your debug version
        const records = await Promise.all(
          req.files.map(f => {
            const relativePath = path.relative(path.join(__dirname, '..'), f.path);
            console.log('[uploadDocuments] inserting:', relativePath);
            return RequestPhoto.create({
              requestId: id,
              clientAccountId: request.clientAccountId,
              storagePath: relativePath,
              attachmentType: 'supporting',
              originalName: f.originalname,
              mimeType: f.mimetype,
              sizeBytes: f.size,
              uploadedByUserId: req.admin.id,
            });
          })
        );
  
        res.json({
          message: `${records.length} document(s) uploaded successfully.`,
          files: req.files.map(f => ({ originalName: f.originalname, filename: f.filename })),
          count: records.length,
        });
  
      } catch (e) {
        console.error('[uploadDocuments] error:', e);
        res.status(500).json({ message: e.message });
      }
    },
  ];



  const inviteTeamMember = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });
  
    const adminId = req.admin.id;
  
    // Block invited team members from inviting others — only root admins may invite
    const isTeamMember = await TeamMember.findOne({ where: { admin_id: adminId } });
    if (isTeamMember)
      return res.status(403).json({ message: 'Only admins are allowed to invite team members.' });
  
    // Check how many team members this admin has already invited
    const inviteCount = await TeamMember.count({
      where: { invited_by_admin_id: adminId },
    });
    if (inviteCount >= 3)
      return res.status(403).json({ message: 'You have reached the maximum limit of 3 team members.' });

    // Check if an admin with this email already exists
    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin)
      return res.status(409).json({ message: 'An account with that email already exists.' });
  
    // Check if a team member with this email already exists
    const existingMember = await TeamMember.findOne({
      include: [{ model: Admin, as: 'admin', where: { email }, attributes: [] }],
    });
    if (existingMember)
      return res.status(409).json({ message: 'A team member with that email already exists.' });
  
    const hashed = await bcrypt.hash(password, 12);
    const newAdmin = await Admin.create({ email, password: hashed });
  
    const teamMember = await TeamMember.create({
      admin_id: newAdmin.id,
      invited_by_admin_id: adminId,
    });
  
    res.status(201).json({
      message: 'Team member invited successfully.',
      teamMember: {
        id: teamMember.id,
        admin_id: teamMember.admin_id,
        invited_by_admin_id: teamMember.invited_by_admin_id,
        email: newAdmin.email,
      },
    });
  });

    const approvePartnerTeamMember = safe(async (req, res) => {
      const adminId = req.admin.id;
      const { id } = req.params;
    
      const member = await PartnerTeamMember.findByPk(id);
      if (!member)
        return res.status(404).json({ message: 'Team member not found.' });
    
      if (member.status === 'approved') {
        return res.json({
          message: 'Team member already approved.',
          teamMember: { id: member.id, partner_id: member.partner_id, status: member.status },
        });
      }
      if (member.status !== 'pending') {
        console.log('[approve] unexpected status', id, JSON.stringify(member.status));
        return res.status(409).json({ message: `Request is already ${member.status}.` });
      }

      const partner = await Partner.findByPk(member.partner_id);
      if (!partner) return res.status(404).json({ message: 'Partner not found.' });

      const requestType = member.request_type || 'add';
      const newStatus = requestType === 'add' ? 'active' : 'inactive';
      await changePartnerStatus({
        partner,
        newStatus,
        UserStatusLog,
        changedByType: 'super_admin',
        changedById: adminId,
        reason: req.body?.reason || member.reason || `Super Admin approved ${requestType} request.`,
      });

      member.status = 'approved';
      member.approved_by_admin_id = adminId;
      member.approved_at = new Date();
      await member.save();
  
      syncTeamMemberStatus(member, partner).catch((e) =>
        console.error('[approvePartnerTeamMember] Airtable sync:', e.message)
      );
  
      if (AuditLog?.create) {
        try {
          const auditAction = {
            add: 'TEAM_MEMBER_ADDED',
            deactivate: 'TEAM_MEMBER_DEACTIVATED',
            remove: 'TEAM_MEMBER_REMOVED',
          }[requestType] || 'TEAM_MEMBER_STATUS_CHANGED';
          await AuditLog.create({
            userId: adminId,
            userRole: req.admin.role || 'super_admin',
            clientId: partner.clientAccountId ?? null,
            propertyId: null,
            requestId: null,
            action: auditAction,
            previousStatus: 'pending',
            newStatus: 'approved',
            timestamp: new Date(),
            ipAddress: req.ip || null,
            notes: member.reason || null,
          });
        } catch (e) {
          console.error('[approvePartnerTeamMember] AuditLog failed:', e.name, e.message);
        }
      }
      
      if (partner.clientAccountId) {
        try {
          const teamMemberRecipients = await notificationRecipients.forTeamMemberStatusChanged(partner.clientAccountId);
          const teamMemberNotifications = await notificationService.sendNotifications({
            type: NOTIFICATION_EVENTS.TEAM_MEMBER_STATUS_CHANGED,
            payload: {
              memberEmail: partner.email,
              requestType,
              status: 'approved',
              reason: member.reason,
            },
          }, teamMemberRecipients);
          teamMemberNotifications.forEach((result) => {
            if (result.status === 'rejected') {
              console.error('[Team member notification] Delivery failed:', result.reason?.message || result.reason);
            }
          });
        } catch (error) {
          console.error('[Team member notification] Could not load recipients:', error.message);
        }
      }
    
      res.json({

        message: 'Team member approved successfully.',
        teamMember: {
          id: member.id,
          partner_id: member.partner_id,
          invited_by_partner_id: member.invited_by_partner_id,
          status: member.status,
          request_type: requestType,
          reason: member.reason,
          userStatus: partner.status,
          approved_by_admin_id: member.approved_by_admin_id,
          approved_at: member.approved_at,
        },
      });
    });
  
  const denyPartnerTeamMember = safe(async (req, res) => {
    const adminId = req.admin.id;
    const { id } = req.params;
  
    const member = await PartnerTeamMember.findByPk(id);
    if (!member)
      return res.status(404).json({ message: 'Team member not found.' });
  
   // Idempotent: a repeated deny (e.g. double-click) returns success instead of an error
if (member.status === 'denied') {
  return res.json({
    message: 'Team member already denied.',
    teamMember: { id: member.id, status: member.status },
  });
}
if (member.status !== 'pending') {
  return res.status(409).json({ message: `Request is already ${member.status}.` });
}
    member.status = 'denied';
    member.approved_by_admin_id = adminId;
    member.approved_at = new Date();
    await member.save();

    const deniedPartner = await Partner.findByPk(member.partner_id);
    if (deniedPartner) {
      syncTeamMemberStatus(member, deniedPartner).catch((e) =>
        console.error('[denyPartnerTeamMember] Airtable sync:', e.message)
      );
    }
    
    if (AuditLog?.create) {
      const auditAction = {
        add: 'TEAM_MEMBER_ADD_DENIED',
        deactivate: 'TEAM_MEMBER_DEACTIVATION_DENIED',
        remove: 'TEAM_MEMBER_REMOVAL_DENIED',
      }[member.request_type || 'add'] || 'TEAM_MEMBER_REQUEST_DENIED';
      await AuditLog.create({
        userId: adminId,
        userRole: req.admin.role || 'super_admin',
        clientId: member.client_account_id ?? null,
        propertyId: null,
        requestId: null,
        action: auditAction,
        previousStatus: 'pending',
        newStatus: 'denied',
        timestamp: new Date(),
        ipAddress: req.ip || null,
        notes: member.reason || null,
      });
    }
  
    res.json({
      message: 'Team member denied successfully.',
      teamMember: {
        id: member.id,
        partner_id: member.partner_id,
        invited_by_partner_id: member.invited_by_partner_id,
        status: member.status,
        request_type: member.request_type || 'add',
        reason: member.reason,
        approved_by_admin_id: member.approved_by_admin_id,
        approved_at: member.approved_at,
      },
    });
  });
  
   
  const getTeamMembers = safe(async (req, res) => {
    const adminId = req.admin.id;
  
    const teamMembers = await TeamMember.findAll({
      where: { invited_by_admin_id: adminId },
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'email'] }],
      order: [['created_at', 'DESC']],
    });
  
    res.json({ teamMembers });
  });


  const checkAdminRole = safe(async (req, res) => {
    const adminId = req.admin.id;
  
    const isTeamMember = await TeamMember.findOne({ where: { admin_id: adminId } });
  
    res.json({
      admin: !isTeamMember,
      email: req.admin.email,
    });
  });

  const getAllPartnerTeamMembers = safe(async (req, res) => {
    const partnerTeamMembers = await PartnerTeamMember.findAll({
      include: [
        { model: Partner, as: 'partner',          attributes: ['id', 'username', 'email', 'accountRole', 'status'] },
        { model: Partner, as: 'invitedByPartner', attributes: ['id', 'username', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ partnerTeamMembers });
  });

  const getUserApprovalQueue = safe(async (req, res) => {
    const [pendingUsers, pendingRequests] = await Promise.all([
      Partner.findAll({
        where: { status: 'pending_approval' },
        attributes: ['id', 'username', 'email', 'accountRole', 'clientAccountId', 'status', 'createdAt'],
        order: [['created_at', 'ASC']],
      }),
      PartnerTeamMember.findAll({
        where: { status: 'pending' },
        include: [
          { model: Partner, as: 'partner', attributes: ['id', 'username', 'email', 'accountRole', 'status'] },
          { model: Partner, as: 'invitedByPartner', attributes: ['id', 'username', 'email'] },
        ],
        order: [['created_at', 'ASC']],
      }),
    ]);

    res.json({ pendingUsers, pendingRequests });
  });


  
  return {
    register,
    login,
    resetPassword,
    getAllPartners,
    getAllClientAccounts,
    getClientAccount,
    createClientAccount,
    createClientLocation,
    updateClientRequestSettings,
    updateClientAccountsPayable,
    updateClientPriceVisibility,
    getPartner,
    updatePartner,
    deletePartner,
    getAllRequests,
    getAuditTrail,
    getRequest,
    getPaymentConfirmationQueue,
    confirmInvoicePayment,
    markRequestUnderReview,
    updateRequestStatus,
    uploadDocuments,  
    inviteTeamMember,
    getTeamMembers,
    checkAdminRole,
    setPartnerStatus,
    approvePartnerActivation,
    getUserApprovalQueue,
    approvePartnerTeamMember,
    denyPartnerTeamMember,
    getAllPartnerTeamMembers
  };

};




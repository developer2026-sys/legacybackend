'use strict';

const { Router } = require('express');
const adminAuth = require('../middleware/admin');
const partnershipSettingsController = require('../controller/partnershipSettingsController');
const { MemorialRequest, RequestPhoto,Partner, Admin } = require('../models');
const { uploadMonumentDocs } = require('../controller/monumentSetting');
const requireRole = require('../middleware/requireRole');
module.exports = (models) => {
  const { getSettings, updateSettings } = partnershipSettingsController(models);

  const router = Router();
  const controller = require('../controller/admin')(models); // ← pass models here
  const monumentAdminController = require('../controller/monumentSettingAdmin')(models);
  const requestOperations = require('../controller/requestOperations')(models);
  const pricingController = require('../controller/pricing')(models);

 
  // Public authentication endpoints
  router.post('/register',       controller.register);
  router.post('/login',          controller.login);

  // Protected
  router.use(adminAuth);
  router.use(requireRole('super_admin'));
  router.post('/reset-password', controller.resetPassword);

  router.get('/pricing', pricingController.list);
  router.post('/pricing', pricingController.save);
  router.get('/invoices/payment-confirmation-queue', controller.getPaymentConfirmationQueue);
  router.patch('/invoices/:id/confirm-payment', controller.confirmInvoicePayment);

  // Documents are platform data and must never be publicly enumerable by ID.
  router.get('/requests/:id/documents', async (req, res) => {
    const docs = await RequestPhoto.findAll({ where: { requestId: req.params.id } });
    res.json({ documents: docs });
  });

  
  router.patch('/settings/email-reminders', async (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'enabled must be a boolean' });
    }
    await Admin.update(
      { emailRemindersEnabled: enabled },
      { where: { id: req.admin.id } }
    );
    res.json({ emailRemindersEnabled: enabled });
  });

  router.get('/settings/email-reminders', async (req, res) => {
    const admin = await Admin.findByPk(req.admin.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    res.json({ emailRemindersEnabled: admin.emailRemindersEnabled });
  });

  router.post('/requests/:id/documents', ...controller.uploadDocuments);
  router.post('/team-members/invite', controller.inviteTeamMember);
  // Partners
  router.get   ('/client-accounts', controller.getAllClientAccounts);
  router.get   ('/client-accounts/:id', controller.getClientAccount);
  router.post  ('/client-accounts', controller.createClientAccount);
  router.post  ('/client-accounts/:id/locations', controller.createClientLocation);
  router.patch ('/client-accounts/:id/request-settings', controller.updateClientRequestSettings);
  router.patch ('/client-accounts/:id/accounts-payable', controller.updateClientAccountsPayable);
  router.patch ('/client-accounts/:id/price-visibility', controller.updateClientPriceVisibility);

  router.get   ('/partners',     controller.getAllPartners);
  router.get   ('/partners/:id', controller.getPartner);
  router.put   ('/partners/:id', controller.updatePartner);
  router.patch ('/partners/:id/status', controller.setPartnerStatus);
  router.patch ('/partners/:id/approve', controller.approvePartnerActivation);
  router.delete('/partners/:id', controller.deletePartner);

  // Requests
  router.patch('/requests/:id/review', controller.markRequestUnderReview);
  router.get  ('/requests',            controller.getAllRequests);
  router.get  ('/requests/:id',        controller.getRequest);
  router.get('/audit-trail', controller.getAuditTrail);
  router.patch('/requests/:id/status', controller.updateRequestStatus);
  router.patch(
    '/requests/:id/operations',
    requestOperations.parseCompletionUpload,
    requestOperations.updateOperations,
  );
  router.post(
    '/requests/:id/completion-photos',
    requestOperations.parseCompletionUpload,
    requestOperations.uploadCompletionPhotos,
  );
  const forceRequestStatus = (status) => (req, _res, next) => {
    req.body = { ...(req.body || {}), status };
    next();
  };
  router.patch('/requests/:id/approve', forceRequestStatus('APPROVED'), controller.updateRequestStatus);
  router.patch('/requests/:id/deny', forceRequestStatus('REJECTED'), controller.updateRequestStatus);
  router.patch('/requests/:id/request-information', forceRequestStatus('NEEDS_INFORMATION'), controller.updateRequestStatus);
  router.get('/me', controller.checkAdminRole);
  router.get('/team-members', controller.getTeamMembers);


  router.patch('/partner-team-members/:id/approve', controller.approvePartnerTeamMember);
  router.patch('/partner-team-members/:id/deny',    controller.denyPartnerTeamMember);
  router.get('/partner-team-members', controller.getAllPartnerTeamMembers);
  router.get('/user-approval-queue', controller.getUserApprovalQueue);
  
  router.get('/partners/:id/settings', getSettings);
  router.patch('/partners/:id/settings', updateSettings);

  // Monument Setting
  router.get  ('/monument-setting',     monumentAdminController.getAllMonumentSettingRequests);
  router.get  ('/monument-setting/:id', monumentAdminController.getMonumentSettingRequest);
  router.patch('/monument-setting/:id', monumentAdminController.updateMonumentSettingRequest);
  router.post(
    '/monument-setting/:id/completion-photos',
    (req, res, next) => monumentAdminController.completionPhotoUpload(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Each completion photo must be 10 MB or smaller.' });
      }
      return res.status(400).json({ message: err.message });
    }),
    monumentAdminController.saveCompletionPhotos,
  );
  router.post(
    '/monument-setting/:id/documents',
    (req, res, next) => {
      uploadMonumentDocs(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Each file must be 10 MB or smaller.' });
        }
        return res.status(400).json({ message: err.message });
      });
    },
    monumentAdminController.uploadMonumentSettingDocuments,
  );

  return router;
};
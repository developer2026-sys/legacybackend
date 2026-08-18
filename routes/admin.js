'use strict';

const { Router } = require('express');
const adminAuth = require('../middleware/admin');
const partnershipSettingsController = require('../controller/partnershipSettingsController');
const { MemorialRequest, RequestPhoto,Partner, Admin } = require('../models');
module.exports = (models) => {
  const { getSettings, updateSettings } = partnershipSettingsController(models);

  const router = Router();
  const controller = require('../controller/admin')(models); // ← pass models here

 
  // Public
  router.get('/requests/:id/documents', async (req, res) => {
    const docs = await RequestPhoto.findAll({ where: { requestId: req.params.id } });
    res.json({ documents: docs });
  });
  router.post('/register',       controller.register);
  router.post('/login',          controller.login);
  router.post('/reset-password', controller.resetPassword);

  // Protected
  router.use(adminAuth);

  
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
  router.get   ('/partners',     controller.getAllPartners);
  router.get   ('/partners/:id', controller.getPartner);
  router.put   ('/partners/:id', controller.updatePartner);
  router.delete('/partners/:id', controller.deletePartner);

  // Requests
  router.get  ('/requests',            controller.getAllRequests);
  router.get  ('/requests/:id',        controller.getRequest);
  router.patch('/requests/:id/status', controller.updateRequestStatus);
router.patch('/requests/:id/price',controller.updateRequestPrice)
  router.get('/me', controller.checkAdminRole);
  router.get('/team-members', controller.getTeamMembers);


  router.patch('/partner-team-members/:id/approve', controller.approvePartnerTeamMember);
  router.patch('/partner-team-members/:id/deny',    controller.denyPartnerTeamMember);
  router.get('/partner-team-members', controller.getAllPartnerTeamMembers);
  
  router.get('/partners/:id/settings', getSettings);
  router.patch('/partners/:id/settings', updateSettings);

  return router;
};
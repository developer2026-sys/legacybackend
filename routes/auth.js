'use strict';

const express = require('express');
const router = express.Router();
const {
  register,
  login,
  resetPassword,
  getTeamMembers,
  checkPartnerRole,
  invitePartnerTeamMember,
  requestPartnerStatusChange,
} = require('../controller/auth');
const authenticate = require('../middleware/middleware');
const requireRole = require('../middleware/requireRole');
const {
  getMyAccount,
  getMyLocations,
  createLocation,
} = require('../controller/clientAccount');
router.post('/register', register);
router.post('/login', login);
router.post(
  '/reset-password',
  authenticate,
  requireRole('client_admin', 'family_advisor'),
  resetPassword,
);
router.post(
    '/partner/team-members/invite',
    authenticate,
    requireRole('client_admin'),
    invitePartnerTeamMember
  );


  router.get('/partner/team-members', authenticate, requireRole('client_admin', 'family_advisor'), getTeamMembers);
  router.post(
    '/partner/team-members/:partnerId/status-request',
    authenticate,
    requireRole('client_admin'),
    requestPartnerStatusChange,
  );
  router.get('/partner/me', authenticate, requireRole('client_admin', 'family_advisor'), checkPartnerRole);
  router.get('/client-account', authenticate, requireRole('client_admin', 'family_advisor'), getMyAccount);
  router.get('/client-account/locations', authenticate, requireRole('client_admin', 'family_advisor'), getMyLocations);
  router.post('/client-account/locations', authenticate, requireRole('client_admin'), createLocation);
module.exports = router;
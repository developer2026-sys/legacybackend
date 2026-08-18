'use strict';

const express = require('express');
const router = express.Router();
const { register, login,resetPassword,getTeamMembers,checkPartnerRole, invitePartnerTeamMember } = require('../controller/auth');
const authenticate = require('../middleware/middleware');
router.post('/register', register);
router.post('/login', login);
router.post('/reset-password', resetPassword);
router.post(
    '/partner/team-members/invite',
    authenticate,
    invitePartnerTeamMember
  );


  router.get('/partner/team-members', authenticate, getTeamMembers);
  router.get('/partner/me', authenticate,checkPartnerRole);
module.exports = router;
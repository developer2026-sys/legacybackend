'use strict';

const jwt = require('jsonwebtoken');
const { Partner } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("HEADER ERROR")
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const partner = await Partner.findByPk(decoded.id);
    // Keep platform-admin tokens from authenticating as a Partner when IDs
    // happen to overlap between the separate tables.
    if (
      !partner
      || decoded.role === 'super_admin'
      || decoded.role !== partner.role
      || !partner.clientAccountId
      || partner.status !== 'active'
    ) {
      console.log("MIDDLEWARE ERROR")
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    // A newly created Family Advisor may authenticate once with the temporary
    // password, but cannot use the portal until that password is replaced.
    // The reset endpoint is the only authenticated exception.
    const isPasswordResetRequest = req.path === '/reset-password'
      || req.originalUrl.split('?')[0].endsWith('/reset-password');
    if (partner.mustChangePassword && !isPasswordResetRequest) {
      return res.status(403).json({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your temporary password before continuing.',
      });
    }

    req.partner = partner;
    req.clientAccountId = partner.clientAccountId;
    req.accountRole = partner.accountRole || 'client_admin';
    req.userRole = req.accountRole;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
};

module.exports = authenticate;
'use strict';

const jwt = require('jsonwebtoken');
const { Admin, TeamMember } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';

/**
 * Middleware: verifies the Bearer token and loads the current platform
 * account. Authorization is handled by the shared requireRole middleware.
 */
module.exports = async function adminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Partner and Admin IDs come from separate tables and can overlap. Do not
    // let a valid partner token authenticate as an Admin by ID coincidence.
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ message: 'Forbidden: Super Admin access is required.' });
    }

    const admin = await Admin.findByPk(decoded.id);
    if (!admin || admin.role !== 'super_admin') {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }

    // Legacy invited accounts have no supported role in the current RBAC
    // matrix; do not let the model's super_admin default grant them access.
    const teamMembership = TeamMember?.findOne
      ? await TeamMember.findOne({ where: { admin_id: admin.id } })
      : null;
    if (teamMembership) {
      return res.status(403).json({ message: 'This account is not authorized for Super Admin access.' });
    }

    req.admin = admin;
    req.userRole = admin.role;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
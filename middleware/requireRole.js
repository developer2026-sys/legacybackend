'use strict';

/**
 * Shared server-side role guard.
 *
 * Partner roles come from req.partner.accountRole and platform roles come
 * from req.admin.role. Both authentication middleware attach the resolved
 * role to req.userRole so downstream handlers never need to trust a
 * client-supplied role.
 */
module.exports = function requireRole(...allowedRoles) {
  const roles = allowedRoles.flat();

  if (!roles.length) {
    throw new Error('requireRole needs at least one allowed role.');
  }

  return (req, res, next) => {
    const role = req.admin?.role || req.partner?.accountRole || req.userRole;

    if (!role || !roles.includes(role)) {
      return res.status(403).json({
        message: `Forbidden: requires one of the following roles: ${roles.join(', ')}.`,
      });
    }

    req.userRole = role;
    return next();
  };
};
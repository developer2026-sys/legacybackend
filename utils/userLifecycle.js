'use strict';

const USER_STATUSES = ['pending_approval', 'active', 'suspended', 'inactive'];

async function changePartnerStatus({
  partner,
  newStatus,
  UserStatusLog,
  changedByType,
  changedById = null,
  reason = null,
}) {
  if (!USER_STATUSES.includes(newStatus)) {
    throw new Error(`Invalid user status: ${newStatus}`);
  }

  const oldStatus = partner.status || 'active';
  if (oldStatus === newStatus) return false;

  await partner.update({ status: newStatus });
  await UserStatusLog.create({
    partnerId: partner.id,
    changedByType,
    changedById,
    oldStatus,
    newStatus,
    reason,
  });
  return true;
}

module.exports = { USER_STATUSES, changePartnerStatus };
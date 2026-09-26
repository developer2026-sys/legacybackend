'use strict';

async function ensureRequestStatusHistory(models) {
  const { MemorialRequest, RequestStatusHistory } = models;
  const returnedRequests = await MemorialRequest.findAll({
    where: { status: ['NEEDS_INFORMATION', 'REJECTED'] },
    attributes: ['id', 'clientAccountId', 'status', 'adminNotes', 'deniedAt', 'updatedAt', 'createdAt'],
  });

  for (const request of returnedRequests) {
    const alreadySeeded = await RequestStatusHistory.findOne({
      where: {
        requestId: request.id,
        toStatus: request.status,
        changedByRole: 'legacy_admin',
      },
    });
    if (alreadySeeded) continue;

    await RequestStatusHistory.create({
      requestId: request.id,
      clientAccountId: request.clientAccountId,
      fromStatus: 'SUBMITTED',
      toStatus: request.status,
      reason: request.adminNotes || null,
      changedByRole: 'legacy_admin',
      createdAt: request.deniedAt || request.updatedAt || request.createdAt,
    });
  }
}

module.exports = ensureRequestStatusHistory;
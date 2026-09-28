'use strict';

/**
 * Notification policy: this module owns who receives each workflow event.
 * Delivery details belong to notificationService.js.
 */



const createNotificationRecipients = ({ Partner, ClientAccount, Op }) => ({
  async forRequestSubmitted(clientAccountId) {
    if (!Partner?.findAll) return [];
    return Partner.findAll({
      where: {
        clientAccountId,
        accountRole: 'client_admin',
        status: 'active',
        ...(Op ? { email: { [Op.ne]: null } } : {}),
      },
      attributes: ['id', 'email', 'contactName', 'username'],
    });
  },

  async forRequestStatusChanged(request) {
    if (!Partner?.findByPk || !request?.partnerId) return [];
    const [advisor, clientAdmins] = await Promise.all([
      Partner.findByPk(request.partnerId),
      request.clientAccountId && Partner.findAll
        ? Partner.findAll({
          where: {
            clientAccountId: request.clientAccountId,
            accountRole: 'client_admin',
            status: 'active',
            ...(Op ? { email: { [Op.ne]: null } } : {}),
          },
          attributes: ['id', 'email', 'contactName', 'username'],
        })
        : [],
    ]);
    const recipients = new Map();
    for (const recipient of [advisor, ...(clientAdmins || [])]) {
      if (recipient?.email) recipients.set(recipient.email.toLowerCase(), recipient);
    }
    return [...recipients.values()];
  },

  async forMonumentSettingStatusChanged(request) {
    if (!Partner?.findOne && !Partner?.findAll) return [];

    const [originalAdvisor, clientAdmins] = await Promise.all([
      Partner.findOne
        ? Partner.findOne({
          where: {
            id: request.partnerId,
            ...(request.clientAccountId ? { clientAccountId: request.clientAccountId } : {}),
          },
          attributes: ['id', 'email', 'contactName', 'username'],
        })
        : null,
      request.clientAccountId && Partner.findAll
        ? Partner.findAll({
          where: {
            clientAccountId: request.clientAccountId,
            accountRole: 'client_admin',
            status: 'active',
            ...(Op ? { email: { [Op.ne]: null } } : {}),
          },
          attributes: ['id', 'email', 'contactName', 'username'],
        })
        : [],
    ]);

    const recipients = new Map();
    for (const recipient of [originalAdvisor, ...(clientAdmins || [])]) {
      if (recipient?.email) recipients.set(recipient.email.toLowerCase(), recipient);
    }
    return [...recipients.values()];
  },

  async forTeamMemberStatusChanged(clientAccountId) {
    if (!Partner?.findAll) return [];
    return Partner.findAll({
      where: {
        clientAccountId,
        accountRole: 'client_admin',
        status: 'active',
        ...(Op ? { email: { [Op.ne]: null } } : {}),
      },
      attributes: ['id', 'email', 'contactName', 'username'],
    });
  },
  
  async forInvoiceCreated(clientAccountId) {
    if (!ClientAccount?.findByPk || !clientAccountId) return [];
    const account = await ClientAccount.findByPk(clientAccountId);
    return account?.accountsPayableEmail
      ? [{ email: account.accountsPayableEmail, name: 'Accounts Payable' }]
      : [];
  },
});

module.exports = {
  createNotificationRecipients,
};
'use strict';

/*
 * The original project has no migration runner. This idempotent migration is
 * called once at boot so an existing MySQL database can receive the tenancy
 * columns without dropping data. New deployments can run it harmlessly too.
 */

const { DataTypes, Op } = require('sequelize');

const TENANT_COLUMNS = {
  partners: {
    account_role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'client_admin' },
    must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: {
      type: DataTypes.ENUM('pending_approval', 'active', 'suspended', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  memorial_requests: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    location_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  monument_setting_requests: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    location_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  partnership_settings: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  partner_team_members: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    member_role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'family_advisor' },
    request_type: {
      type: DataTypes.ENUM('add', 'deactivate', 'remove'),
      allowNull: false,
      defaultValue: 'add',
    },
    reason: { type: DataTypes.TEXT, allowNull: true },
  },
  request_photos: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  monument_setting_documents: {
    client_account_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  admins: {
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: 'super_admin' },
  },
};

const tableExists = (tables, name) =>
  tables.some((table) => String(table).toLowerCase() === name.toLowerCase());

async function addColumnIfMissing(queryInterface, table, column, definition) {
  const description = await queryInterface.describeTable(table);
  if (!description[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
}

function slugBase(value) {
  return String(value || 'client-account')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'client-account';
}

async function uniqueSlug(ClientAccount, name, id) {
  const base = slugBase(name);
  let slug = base;
  let counter = 2;
  while (await ClientAccount.findOne({ where: { slug, ...(id ? { id: { [Op.ne]: id } } : {}) } })) {
    slug = `${base}-${counter++}`;
  }
  return slug;
}

async function ensureTenancy(sequelize, models) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  // These are created through the Sequelize models, keeping the schema in
  // one place while still allowing this migration to run before sync().
  if (!tableExists(tables, 'client_accounts')) {
    await models.ClientAccount.sync({ force: false });
  }
  if (!tableExists(tables, 'locations')) {
    await models.Location.sync({ force: false });
  }

  for (const [table, columns] of Object.entries(TENANT_COLUMNS)) {
    if (!tableExists(tables, table)) continue;
    for (const [column, definition] of Object.entries(columns)) {
      await addColumnIfMissing(queryInterface, table, column, definition);
    }
  }

  const {
    Admin,
    Partner,
    PartnerTeamMember,
    PartnershipSettings,
    MemorialRequest,
    MonumentSettingRequest,
    ClientAccount,
    Location,
    RequestPhoto,
    MonumentSettingDocument,
  } = models;

  // Backfill legacy partner records into separate client accounts. This is
  // intentionally conservative: no existing partner data is merged.
  await Partner.sync(); // creates "partners" if missing
  const partners = await Partner.findAll();
  for (const partner of partners) {
    let account = partner.clientAccountId
      ? await ClientAccount.findByPk(partner.clientAccountId)
      : null;

    if (!account) {
      const name = partner.contactName || partner.organization || partner.username || `Client ${partner.id}`;
      account = await ClientAccount.create({
        name: `${name} Account`,
        slug: await uniqueSlug(ClientAccount, `${name}-${partner.id}`),
        accountType: 'client',
        status: 'active',
      });
      await Location.create({
        clientAccountId: account.id,
        name: 'Primary Location',
        status: 'active',
      });
      await partner.update({
        clientAccountId: account.id,
        accountRole: partner.accountRole || 'client_admin',
      });
    }

    await MemorialRequest.update(
      { clientAccountId: account.id },
      { where: { partnerId: partner.id, clientAccountId: null } },
    );
    await MonumentSettingRequest.update(
      { clientAccountId: account.id },
      { where: { partnerId: partner.id, clientAccountId: null } },
    );
    await PartnershipSettings.update(
      { clientAccountId: account.id },
      { where: { partnerId: partner.id, clientAccountId: null } },
    );
  }

  const photos = await RequestPhoto.findAll({ where: { clientAccountId: null } });
  for (const photo of photos) {
    const request = await MemorialRequest.findByPk(photo.requestId);
    if (request?.clientAccountId) {
      await photo.update({ clientAccountId: request.clientAccountId });
    }
  }

  const documents = await MonumentSettingDocument.findAll({ where: { clientAccountId: null } });
  for (const document of documents) {
    const request = await MonumentSettingRequest.findByPk(document.monumentSettingRequestId);
    if (request?.clientAccountId) {
      await document.update({ clientAccountId: request.clientAccountId });
    }
  }

  const memberships = await PartnerTeamMember.findAll();
  for (const membership of memberships) {
    const member = await Partner.findByPk(membership.partner_id);
    const inviter = await Partner.findByPk(membership.invited_by_partner_id);
    const clientAccountId = inviter?.clientAccountId || membership.client_account_id || member?.clientAccountId;
    if (!clientAccountId) continue;

    await membership.update({
      client_account_id: clientAccountId,
      member_role: membership.member_role || 'family_advisor',
    });
    if (member && !member.clientAccountId) {
      await member.update({
        clientAccountId,
        accountRole: 'family_advisor',
      });
    } else if (member && member.clientAccountId !== clientAccountId) {
      await member.update({
        clientAccountId,
        accountRole: 'family_advisor',
      });
    }
    await MemorialRequest.update(
      { clientAccountId },
      { where: { partnerId: membership.partner_id } },
    );
    await MonumentSettingRequest.update(
      { clientAccountId },
      { where: { partnerId: membership.partner_id } },
    );
    await PartnershipSettings.update(
      { clientAccountId },
      { where: { partnerId: membership.partner_id } },
    );
    const memberRequests = await MemorialRequest.findAll({
      where: { partnerId: membership.partner_id },
      attributes: ['id'],
    });
    const memberRequestIds = memberRequests.map((request) => request.id);
    if (memberRequestIds.length) {
      await RequestPhoto.update(
        { clientAccountId },
        { where: { requestId: { [Op.in]: memberRequestIds } } },
      );
    }
    const memberMonumentRequests = await MonumentSettingRequest.findAll({
      where: { partnerId: membership.partner_id },
      attributes: ['id'],
    });
    const memberMonumentRequestIds = memberMonumentRequests.map((request) => request.id);
    if (memberMonumentRequestIds.length) {
      await MonumentSettingDocument.update(
        { clientAccountId },
        { where: { monumentSettingRequestId: { [Op.in]: memberMonumentRequestIds } } },
      );
    }
  }

  // Existing Admin records represent the platform-level Super Admin role.
  await Admin.update({ role: 'super_admin' }, { where: {} });
}

module.exports = ensureTenancy;
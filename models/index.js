'use strict';

const sequelize = require('../db');
const defineModels = require('./model');
const defineAdmin = require('./adminmodel');
const defineTeamMember = require('./teammember');
const definePartnerTeamMember = require('./partnerteammember');
const definePartnershipSettings = require('./partnershipSettings');
const defineMonumentSetting = require('./monumentsetting');

const { Partner, MemorialRequest, RequestPhoto } = defineModels(sequelize);
const { Admin } = defineAdmin(sequelize);
const { TeamMember } = defineTeamMember(sequelize);
const { PartnerTeamMember } = definePartnerTeamMember(sequelize);
const { PartnershipSettings } = definePartnershipSettings(sequelize);
const { MonumentSettingRequest, MonumentSettingDocument } = defineMonumentSetting(sequelize);

// TeamMember associations
TeamMember.belongsTo(Admin, {
  foreignKey: 'admin_id',
  as: 'admin',
});

TeamMember.belongsTo(Admin, {
  foreignKey: 'invited_by_admin_id',
  as: 'invitedByAdmin',
});

// PartnerTeamMember associations
PartnerTeamMember.belongsTo(Partner, {
  foreignKey: 'partner_id',
  as: 'partner',
});

PartnerTeamMember.belongsTo(Partner, {
  foreignKey: 'invited_by_partner_id',
  as: 'invitedByPartner',
});

PartnerTeamMember.belongsTo(Admin, {
  foreignKey: 'approved_by_admin_id',
  as: 'approvedByAdmin',
});

// PartnershipSettings associations
Partner.hasOne(PartnershipSettings, {
  foreignKey: 'partnerId',
  as: 'partnershipSettings',
});

PartnershipSettings.belongsTo(Partner, {
  foreignKey: 'partnerId',
  as: 'partner',
});

// MonumentSettingRequest associations
Partner.hasMany(MonumentSettingRequest, {
  foreignKey: 'partnerId',
  as: 'monumentSettingRequests',
});

MonumentSettingRequest.belongsTo(Partner, {
  foreignKey: 'partnerId',
  as: 'partner',
});

MonumentSettingRequest.belongsTo(MemorialRequest, {
  foreignKey: 'linkedMemorialRequestId',
  as: 'linkedMemorialRequest',
});

module.exports = {
  Admin,
  Partner,
  MemorialRequest,
  RequestPhoto,
  TeamMember,
  PartnerTeamMember,
  PartnershipSettings,
  MonumentSettingRequest,
  MonumentSettingDocument,
};
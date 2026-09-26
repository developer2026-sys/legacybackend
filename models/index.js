'use strict';

const sequelize = require('../db');
const defineModels = require('./model');
const defineAdmin = require('./adminmodel');
const defineTeamMember = require('./teammember');
const definePartnerTeamMember = require('./partnerteammember');
const definePartnershipSettings = require('./partnershipSettings');
const defineMonumentSetting = require('./monumentsetting');
const defineClientAccount = require('./clientaccount');
const defineLocation = require('./location');
const defineUserStatusLog = require('./userStatusLog');
const definePricingPackage = require('./pricingPackage');
const definePricingConfiguration = require('./pricingConfiguration');
const defineRequestStatusHistory = require('./requestStatusHistory');
const defineInvoice = require('./invoice');
const defineInvoicePaymentAudit = require('./invoicePaymentAudit');
const defineAuditLog = require('./auditLog');
const defineMonumentSettingStatusHistory = require('./monumentSettingStatusHistory');
const defineApprovalEvent = require('./approvalEvent');
const definePayment = require('./payment');
const defineWorkOrder = require('./workOrder');
const defineSchedule = require('./schedule');

const { Partner, MemorialRequest, RequestPhoto } = defineModels(sequelize);
const { Admin } = defineAdmin(sequelize);
const { TeamMember } = defineTeamMember(sequelize);
const { PartnerTeamMember } = definePartnerTeamMember(sequelize);
const { PartnershipSettings } = definePartnershipSettings(sequelize);
const { MonumentSettingRequest, MonumentSettingDocument } = defineMonumentSetting(sequelize);
const ClientAccount = defineClientAccount(sequelize);
const Location = defineLocation(sequelize);
const UserStatusLog = defineUserStatusLog(sequelize);
const PricingPackage = definePricingPackage(sequelize);
const PricingConfiguration = definePricingConfiguration(sequelize);
const RequestStatusHistory = defineRequestStatusHistory(sequelize);
const Invoice = defineInvoice(sequelize);
const InvoicePaymentAudit = defineInvoicePaymentAudit(sequelize);
const AuditLog = defineAuditLog(sequelize);
const MonumentSettingStatusHistory = defineMonumentSettingStatusHistory(sequelize);
const ApprovalEvent = defineApprovalEvent(sequelize);
const Payment = definePayment(sequelize);
const WorkOrder = defineWorkOrder(sequelize);
const Schedule = defineSchedule(sequelize);

ClientAccount.hasMany(Location, {
  foreignKey: 'clientAccountId',
  as: 'locations',
});
ClientAccount.belongsTo(ClientAccount, {
  foreignKey: 'parentClientAccountId',
  as: 'parentAccount',
});
ClientAccount.hasMany(ClientAccount, {
  foreignKey: 'parentClientAccountId',
  as: 'childAccounts',
});
Location.belongsTo(ClientAccount, {
  foreignKey: 'clientAccountId',
  as: 'clientAccount',
});
Location.hasMany(MemorialRequest, {
  foreignKey: 'locationId',
  as: 'memorialRequests',
});
MemorialRequest.belongsTo(Location, {
  foreignKey: 'locationId',
  as: 'location',
});
PricingPackage.hasMany(PricingConfiguration, {
  foreignKey: 'packageId',
  as: 'pricingConfigurations',
});
PricingConfiguration.belongsTo(PricingPackage, {
  foreignKey: 'packageId',
  as: 'package',
});
Location.hasMany(PricingConfiguration, {
  foreignKey: 'locationId',
  as: 'pricingConfigurations',
});
PricingConfiguration.belongsTo(Location, {
  foreignKey: 'locationId',
  as: 'location',
});
ClientAccount.hasMany(PricingConfiguration, {
  foreignKey: 'clientAccountId',
  as: 'pricingConfigurations',
});
PricingConfiguration.belongsTo(ClientAccount, {
  foreignKey: 'clientAccountId',
  as: 'clientAccount',
});
PricingPackage.hasMany(MemorialRequest, {
  foreignKey: 'packageId',
  as: 'requests',
});
MemorialRequest.belongsTo(PricingPackage, {
  foreignKey: 'packageId',
  as: 'package',
});
Location.hasMany(MonumentSettingRequest, {
  foreignKey: 'locationId',
  as: 'monumentSettingRequests',
});
MonumentSettingRequest.belongsTo(Location, {
  foreignKey: 'locationId',
  as: 'location',
});
ClientAccount.hasMany(Partner, {
  foreignKey: 'clientAccountId',
  as: 'members',
});
Partner.belongsTo(ClientAccount, {
  foreignKey: 'clientAccountId',
  as: 'clientAccount',
});
ClientAccount.hasMany(MemorialRequest, {
  foreignKey: 'clientAccountId',
  as: 'memorialRequests',
});
MemorialRequest.belongsTo(ClientAccount, {
  foreignKey: 'clientAccountId',
  as: 'clientAccount',
});
MemorialRequest.hasMany(RequestStatusHistory, {
  foreignKey: 'requestId',
  as: 'statusHistory',
});
RequestStatusHistory.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'request',
});
MemorialRequest.hasOne(Invoice, {
  foreignKey: 'requestId',
  as: 'invoice',
});
Invoice.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'memorialRequest',
});
MemorialRequest.hasMany(InvoicePaymentAudit, {
  foreignKey: 'requestId',
  as: 'paymentEvents',
});
InvoicePaymentAudit.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'memorialRequest',
});
Invoice.hasMany(InvoicePaymentAudit, {
  foreignKey: 'invoiceId',
  as: 'paymentAudit',
});
InvoicePaymentAudit.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice',
});

MemorialRequest.hasMany(ApprovalEvent, {
  foreignKey: 'requestId',
  as: 'approvalEvents',
});
ApprovalEvent.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'request',
});

MemorialRequest.hasMany(Payment, {
  foreignKey: 'requestId',
  as: 'payments',
});
Payment.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'request',
});
Invoice.hasMany(Payment, {
  foreignKey: 'invoiceId',
  as: 'payments',
});
Payment.belongsTo(Invoice, {
  foreignKey: 'invoiceId',
  as: 'invoice',
});

MemorialRequest.hasOne(WorkOrder, {
  foreignKey: 'requestId',
  as: 'workOrder',
});
WorkOrder.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'request',
});
WorkOrder.hasMany(Schedule, {
  foreignKey: 'workOrderId',
  as: 'schedules',
});
Schedule.belongsTo(WorkOrder, {
  foreignKey: 'workOrderId',
  as: 'workOrder',
});
MemorialRequest.hasMany(Schedule, {
  foreignKey: 'requestId',
  as: 'schedules',
});
Schedule.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'request',
});

Partner.hasMany(UserStatusLog, {
  foreignKey: 'partnerId',
  as: 'statusHistory',
});
UserStatusLog.belongsTo(Partner, {
  foreignKey: 'partnerId',
  as: 'partner',
});
ClientAccount.hasMany(MonumentSettingRequest, {
  foreignKey: 'clientAccountId',
  as: 'monumentSettingRequestsByAccount',
});
MonumentSettingRequest.belongsTo(ClientAccount, {
  foreignKey: 'clientAccountId',
  as: 'clientAccount',
});

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
MemorialRequest.hasMany(MonumentSettingRequest, {
  foreignKey: 'linkedMemorialRequestId',
  as: 'settingRequests',
});
MonumentSettingRequest.hasMany(MonumentSettingStatusHistory, {
  foreignKey: 'monumentSettingRequestId',
  as: 'statusHistory',
});
MonumentSettingStatusHistory.belongsTo(MonumentSettingRequest, {
  foreignKey: 'monumentSettingRequestId',
  as: 'request',
});
MemorialRequest.hasMany(MonumentSettingDocument, {
  foreignKey: 'requestId',
  as: 'settingAttachments',
});
MonumentSettingDocument.belongsTo(MemorialRequest, {
  foreignKey: 'requestId',
  as: 'serviceRequest',
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
  MonumentSettingStatusHistory,
  ClientAccount,
  Location,
  UserStatusLog,
  PricingPackage,
  PricingConfiguration,
  RequestStatusHistory,
  Invoice,
  InvoicePaymentAudit,
  AuditLog,
  ApprovalEvent,
  Payment,
  WorkOrder,
  Schedule,
  // Canonical domain names. These aliases intentionally point to the
  // existing tables so there is still exactly one request and user identity.
  User: Partner,
  ServiceRequest: MemorialRequest,
  Photo: RequestPhoto,
  Attachment: RequestPhoto,
  ActivityEvent: AuditLog,
};
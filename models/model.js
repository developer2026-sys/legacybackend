'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

 
  const Partner = sequelize.define('Partner', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    contactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'must_change_password',
    },
    role: {
      type: DataTypes.ENUM('partner', 'admin'),
      allowNull: false,
      defaultValue: 'partner',
    },
    accountRole: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'client_admin',
      field: 'account_role',
    },
    status: {
      type: DataTypes.ENUM('pending_approval', 'active', 'suspended', 'inactive'),
      allowNull: false,
      defaultValue: 'pending_approval',
    },
    clientAccountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'client_account_id',
    },
    permissions: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    tableName: 'partners',
    timestamps: true,
    underscored: true,
  });

  
  const MemorialRequest = sequelize.define('MemorialRequest', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    partnerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    term: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    clientAccountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'client_account_id',
    },
    locationId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'location_id',
    },
    submittedByUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'submitted_by_user_id',
    },
    requestNumber: {
      type: DataTypes.STRING(40),
      allowNull: true,
      unique: true,
      field: 'request_number',
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'submitted_at',
    },
    draftPricingId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'draft_pricing_id',
    },
    packageType: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    packageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'package_id',
    },
    packageNameSnapshot: { type: DataTypes.STRING, field: 'package_name_snapshot' },
    serviceSnapshot: { type: DataTypes.STRING(255), field: 'service_snapshot', allowNull: true },
    itemSnapshot: { type: DataTypes.STRING(120), field: 'item_snapshot', allowNull: true },
    packagePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    restorationPrice: { type: DataTypes.DECIMAL(10, 3), allowNull: false, field: 'restoration_price' },
    revenueShare: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'revenue_share',
    },
    invoiceAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'invoice_amount',
    },
    pricingEffectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'pricing_effective_date',
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    nameOnMemorial: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    memorialSize: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    memorialType: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    memorialLocation: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cemeteryName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lot: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    space: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    vaseInfo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    adminNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DRAFT',
    },
    approvedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deniedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deniedBy: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  
  }, {
    tableName: 'memorial_requests',
    timestamps: true,
    underscored: true,
  });

 
  const RequestPhoto = sequelize.define('RequestPhoto', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    requestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    clientAccountId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'client_account_id',
    },
    storagePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    attachmentType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'photo',
      field: 'attachment_type',
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'original_name',
    },
    mimeType: {
      type: DataTypes.STRING(120),
      allowNull: true,
      field: 'mime_type',
    },
    sizeBytes: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'size_bytes',
    },
    uploadedByUserId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'uploaded_by_user_id',
    },
  }, {
    tableName: 'request_photos',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['request_id', 'client_account_id'] }],
  });

 
  Partner.hasMany(MemorialRequest, { foreignKey: 'partnerId', as: 'requests' });
  MemorialRequest.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

  MemorialRequest.hasMany(RequestPhoto, { foreignKey: 'requestId', as: 'photos' });
  RequestPhoto.belongsTo(MemorialRequest, { foreignKey: 'requestId', as: 'request' });

  return { Partner, MemorialRequest, RequestPhoto };
};
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
    role: {
      type: DataTypes.ENUM('partner', 'admin'),
      allowNull: false,
      defaultValue: 'partner',
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
    packageType: {
      type: DataTypes.ENUM('basic_annual', 'premium_annual'),
      allowNull: false,
    },
    packagePrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
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
    memorialLocation: {
      type: DataTypes.STRING,
      allowNull: false,
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
      type: DataTypes.ENUM('pending_approval', 'approved', 'completed', 'denied'),
      allowNull: false,
      defaultValue: 'pending_approval',
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
    storagePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'request_photos',
    timestamps: true,
    underscored: true,
  });

 
  Partner.hasMany(MemorialRequest, { foreignKey: 'partnerId', as: 'requests' });
  MemorialRequest.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' });

  MemorialRequest.hasMany(RequestPhoto, { foreignKey: 'requestId', as: 'photos' });
  RequestPhoto.belongsTo(MemorialRequest, { foreignKey: 'requestId', as: 'request' });

  return { Partner, MemorialRequest, RequestPhoto };
};
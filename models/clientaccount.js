'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ClientAccount', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  accountType: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'client',
    field: 'account_type',
  },
  parentClientAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'parent_client_account_id',
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active',
  },
  requestPhotosRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'request_photos_required',
  },
  accountsPayableEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'accounts_payable_email',
  },
  familyAdvisorPriceVisibility: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'none',
    field: 'family_advisor_price_visibility',
  },
  clientAdminPriceVisibility: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'none',
    field: 'client_admin_price_visibility',
  },
}, {
  tableName: 'client_accounts',
  timestamps: true,
  underscored: true,
});
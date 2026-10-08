'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PricingConfiguration', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  clientAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'client_account_id',
  },
  locationId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'location_id',
  },
  packageId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'package_id',
  },
  restorationPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'restoration_price',
  },
  service: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  item: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  revenueShare: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'revenue_share',
  },
  effectiveDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'effective_date',
  },
}, {
  tableName: 'client_property_pricings',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      name: 'idx_cpp_lookup',
      fields: ['client_account_id', 'location_id', 'package_id', 'effective_date'],
    },
  ],
});
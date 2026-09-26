'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Location', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  zip: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'active',
  },
}, {
  tableName: 'locations',
  timestamps: true,
  underscored: true,
});
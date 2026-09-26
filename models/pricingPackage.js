'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PricingPackage', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'pricing_packages',
  timestamps: true,
  underscored: true,
});
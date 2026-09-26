'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('UserStatusLog', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  partnerId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'partner_id',
  },
  changedByType: {
    type: DataTypes.ENUM('super_admin', 'client_admin', 'system'),
    allowNull: false,
    field: 'changed_by_type',
  },
  changedById: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'changed_by_id',
  },
  oldStatus: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'old_status',
  },
  newStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'new_status',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'user_status_logs',
  timestamps: true,
  underscored: true,
});
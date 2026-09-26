'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('RequestStatusHistory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  requestId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'request_id',
  },
  clientAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'client_account_id',
  },
  fromStatus: {
    type: DataTypes.STRING(32),
    allowNull: true,
    field: 'from_status',
  },
  toStatus: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'to_status',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  changedByUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'changed_by_user_id',
  },
  changedByRole: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'changed_by_role',
  },
}, {
  tableName: 'request_status_history',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [{ fields: ['request_id', 'created_at'] }],
});
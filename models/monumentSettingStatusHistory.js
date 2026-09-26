'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MonumentSettingStatusHistory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  monumentSettingRequestId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'monument_setting_request_id',
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
  tableName: 'monument_setting_status_history',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['monument_setting_request_id', 'created_at'], name: 'msh_request_created_idx' }
  ]
});
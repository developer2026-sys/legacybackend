'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Schedule', {
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
  workOrderId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'work_order_id',
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
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    field: 'scheduled_date',
  },
  windowStart: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'window_start',
  },
  windowEnd: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'window_end',
  },
  technicianId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'technician_id',
  },
  technicianName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'technician_name',
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'SCHEDULED',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'schedules',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['request_id', 'scheduled_date'] },
    { fields: ['work_order_id', 'scheduled_date'] },
  ],
});
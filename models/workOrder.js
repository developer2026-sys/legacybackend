'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WorkOrder', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  requestId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    field: 'request_id',
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
  workOrderNumber: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    field: 'work_order_number',
  },
  status: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  assignedTechnicianId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'assigned_technician_id',
  },
  assignedTechnicianName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'assigned_technician_name',
  },
  serviceNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'service_notes',
  },
  internalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'internal_notes',
  },
  completionDetails: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'completion_details',
  },
  completionChecklist: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'completion_checklist',
  },
  actualStartAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'actual_start_at',
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at',
  },
}, {
  tableName: 'work_orders',
  timestamps: true,
  underscored: true,
  indexes: [{ fields: ['request_id', 'status'] }],
});
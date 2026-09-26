'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('InvoicePaymentAudit', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  invoiceId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'invoice_id',
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'user_id',
  },
  role: {
    type: DataTypes.STRING(32),
    allowNull: false,
  },
  clientAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'client_account_id',
  },
  requestId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'request_id',
  },
  previousStatus: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'previous_status',
  },
  newStatus: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'new_status',
  },
  previousPaymentStatus: {
    type: DataTypes.STRING(24),
    allowNull: false,
    field: 'previous_payment_status',
  },
  newPaymentStatus: {
    type: DataTypes.STRING(24),
    allowNull: false,
    field: 'new_payment_status',
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'invoice_payment_audit',
  timestamps: false,
  underscored: true,
  indexes: [{ fields: ['request_id', 'timestamp'] }],
});
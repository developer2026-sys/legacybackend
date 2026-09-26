'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Payment', {
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
  invoiceId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'invoice_id',
  },
  clientAccountId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'client_account_id',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  method: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'confirmed_at',
  },
  confirmedByUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'confirmed_by_user_id',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  paymentAuditId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    unique: true,
    field: 'payment_audit_id',
  },
}, {
  tableName: 'payments',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['request_id', 'created_at'] },
    { fields: ['invoice_id', 'status'] },
  ],
});
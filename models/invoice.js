'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Invoice', {
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
  invoiceNumber: {
    type: DataTypes.STRING(64),
    allowNull: true,
    unique: true,
    field: 'invoice_number',
  },
  issuedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'issued_at',
  },
  accountsPayableEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'accounts_payable_email',
  },
  locationId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'location_id',
  },
  packageId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'package_id',
  },
  status: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'SENT',
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  customerRetailAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'customer_retail_amount',
  },
  restorationAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'restoration_amount',
  },
  revenueShareAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'revenue_share_amount',
  },
  pricingEffectiveDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'pricing_effective_date',
  },
  pricingSnapshot: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'pricing_snapshot',
  },
  paymentStatus: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'PENDING',
    field: 'payment_status',
  },
  paidDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'paid_date',
  },
  paidTime: {
    type: DataTypes.TIME,
    allowNull: true,
    field: 'paid_time',
  },
}, {
  tableName: 'invoices',
  timestamps: true,
  underscored: true,
});
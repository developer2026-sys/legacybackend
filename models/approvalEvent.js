'use strict';

const { DataTypes } = require('sequelize');

/**
 * A decision-level history for a Service Request.
 *
 * RequestStatusHistory remains the complete status timeline. ApprovalEvent is
 * the normalized record used by reporting and approval queues so a decision
 * can never exist without its originating request.
 */
module.exports = (sequelize) => sequelize.define('ApprovalEvent', {
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
  eventType: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'event_type',
  },
  actorUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'actor_user_id',
  },
  actorRole: {
    type: DataTypes.STRING(32),
    allowNull: false,
    field: 'actor_role',
  },
  actorName: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'actor_name',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'approval_events',
  timestamps: true,
  updatedAt: false,
  underscored: true,
  indexes: [
    { fields: ['request_id', 'created_at'] },
    { fields: ['client_account_id', 'event_type', 'created_at'] },
  ],
});
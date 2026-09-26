'use strict';

const { DataTypes } = require('sequelize');

const rejectMutation = () => {
  throw new Error('AuditLog is append-only.');
};

module.exports = (sequelize) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'user_id',
    },
    userRole: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'user_role',
    },
    clientId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'client_id',
    },
    propertyId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: 'property_id',
    },
    requestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: 'request_id',
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    previousStatus: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: 'previous_status',
    },
    newStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: 'new_status',
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true,
      field: 'ip_address',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    tableName: 'audit_logs',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['client_id', 'timestamp'] },
      { fields: ['property_id', 'timestamp'] },
      { fields: ['user_id', 'timestamp'] },
      { fields: ['request_id', 'timestamp'] },
      { fields: ['action', 'timestamp'] },
      { fields: ['timestamp'] },
    ],
    hooks: {
      beforeUpdate: rejectMutation,
      beforeDestroy: rejectMutation,
      beforeBulkUpdate: rejectMutation,
      beforeBulkDestroy: rejectMutation,
      beforeUpsert: rejectMutation,
    },
  });

  for (const method of ['update', 'destroy', 'truncate', 'increment', 'decrement', 'upsert']) {
    AuditLog[method] = rejectMutation;
  }
  const bulkCreate = AuditLog.bulkCreate.bind(AuditLog);
  AuditLog.bulkCreate = (records, options = {}) => {
    if (options.updateOnDuplicate?.length) return rejectMutation();
    return bulkCreate(records, options);
  };
  for (const method of ['update', 'destroy', 'increment', 'decrement']) {
    AuditLog.prototype[method] = rejectMutation;
  }
  const save = AuditLog.prototype.save;
  AuditLog.prototype.save = function saveAuditLog(options) {
    if (!this.isNewRecord) return rejectMutation();
    return save.call(this, options);
  };

  return AuditLog;
};
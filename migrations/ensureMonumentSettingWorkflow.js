'use strict';

const { DataTypes } = require('sequelize');

const DOCUMENT_TYPES = [
  'monument_front_photo',
  'monument_back_photo',
  'base_photo',
  'drawing_dimensions',
  'cemetery_plot_info',
  'foundation_photo',
  'cemetery_approval',
  'work_order',
  'before_photo',
  'after_photo',
  'additional',
];

async function ensureMonumentSettingWorkflow(sequelize, models) {
  const queryInterface = sequelize.getQueryInterface();
  const requestColumns = await queryInterface.describeTable('monument_setting_requests');
  if (!requestColumns.service_notes) {
    await queryInterface.addColumn('monument_setting_requests', 'service_notes', {
      type: DataTypes.TEXT,
      allowNull: true,
    });
  }

  await queryInterface.changeColumn('monument_setting_documents', 'document_type', {
    type: DataTypes.ENUM(...DOCUMENT_TYPES),
    allowNull: false,
    defaultValue: 'additional',
  });

  const { MonumentSettingRequest, MonumentSettingStatusHistory } = models;
  const requests = await MonumentSettingRequest.findAll({
    attributes: ['id', 'status', 'createdAt', 'updatedAt'],
  });

  for (const request of requests) {
    const history = await MonumentSettingStatusHistory.findOne({
      where: { monumentSettingRequestId: request.id },
      attributes: ['id'],
    });
    if (history) continue;

    await MonumentSettingStatusHistory.create({
      monumentSettingRequestId: request.id,
      fromStatus: null,
      toStatus: request.status,
      reason: 'Timeline tracking begins here; earlier status changes were not recorded.',
      changedByRole: 'legacy_system',
      createdAt: request.updatedAt || request.createdAt,
    });
  }
}

module.exports = ensureMonumentSettingWorkflow;
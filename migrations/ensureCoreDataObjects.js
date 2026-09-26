'use strict';

const { DataTypes, Op } = require('sequelize');

const CORE_COLUMNS = {
  partners: {
    permissions: { type: DataTypes.JSON, allowNull: true },
  },
  request_photos: {
    attachment_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'photo' },
    original_name: { type: DataTypes.STRING(255), allowNull: true },
    mime_type: { type: DataTypes.STRING(120), allowNull: true },
    size_bytes: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
    uploaded_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  monument_setting_documents: {
    request_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
  invoices: {
    customer_retail_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    restoration_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    revenue_share_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    pricing_effective_date: { type: DataTypes.DATEONLY, allowNull: true },
    pricing_snapshot: { type: DataTypes.JSON, allowNull: true },
    invoice_number: { type: DataTypes.STRING(64), allowNull: true },
    issued_at: { type: DataTypes.DATE, allowNull: true },
    accounts_payable_email: { type: DataTypes.STRING(255), allowNull: true },
    location_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    package_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'SENT' },
  },
  work_orders: {
    location_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    internal_notes: { type: DataTypes.TEXT, allowNull: true },
    completion_details: { type: DataTypes.TEXT, allowNull: true },
    completion_checklist: { type: DataTypes.JSON, allowNull: true },
    actual_start_at: { type: DataTypes.DATE, allowNull: true },
  },
  schedules: {
    location_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  },
};

const normalizeTables = (tables) => tables.map((table) =>
  String(typeof table === 'string' ? table : table.tableName || table).toLowerCase()
);

async function addColumns(queryInterface, tables) {
  for (const [table, columns] of Object.entries(CORE_COLUMNS)) {
    if (!tables.includes(table)) continue;
    const description = await queryInterface.describeTable(table);
    for (const [column, definition] of Object.entries(columns)) {
      if (!description[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    }
  }
}

async function backfillApprovalEvents(models) {
  const { MemorialRequest, RequestStatusHistory, ApprovalEvent } = models;
  if (!RequestStatusHistory?.findAll || !ApprovalEvent?.findOrCreate) return;

  const history = await RequestStatusHistory.findAll({
    where: { toStatus: { [Op.in]: ['APPROVED', 'REJECTED', 'NEEDS_INFORMATION'] } },
  });
  const typeByStatus = {
    APPROVED: 'approved',
    REJECTED: 'rejected',
    NEEDS_INFORMATION: 'information_requested',
  };

  for (const entry of history) {
    const eventType = typeByStatus[entry.toStatus];
    if (!eventType) continue;
    const request = await MemorialRequest.findByPk(entry.requestId, {
      attributes: ['id', 'clientAccountId'],
    });
    if (!request) continue;
    await ApprovalEvent.findOrCreate({
      where: {
        requestId: request.id,
        eventType,
        createdAt: entry.createdAt,
      },
      defaults: {
        requestId: request.id,
        clientAccountId: request.clientAccountId,
        eventType,
        actorUserId: entry.changedByUserId,
        actorRole: entry.changedByRole || 'legacy',
        notes: entry.reason || null,
        createdAt: entry.createdAt,
      },
    });
  }
}

async function backfillPayments(models) {
  const { InvoicePaymentAudit, Payment, Invoice, MemorialRequest } = models;
  if (!InvoicePaymentAudit?.findAll || !Payment?.findOrCreate) return;

  const audits = await InvoicePaymentAudit.findAll({
    where: { newPaymentStatus: 'PAID' },
  });
  for (const audit of audits) {
    const invoice = await Invoice.findByPk(audit.invoiceId);
    const request = await MemorialRequest.findByPk(audit.requestId);
    if (!invoice || !request) continue;
    await Payment.findOrCreate({
      where: { paymentAuditId: audit.id },
      defaults: {
        requestId: request.id,
        invoiceId: invoice.id,
        clientAccountId: request.clientAccountId,
        amount: invoice.amount || 0,
        status: 'CONFIRMED',
        confirmedAt: audit.timestamp,
        confirmedByUserId: audit.userId,
        paymentAuditId: audit.id,
        notes: 'Backfilled from invoice payment audit.',
      },
    });
  }
}

async function backfillOperations(models) {
  const {
    MonumentSettingRequest,
    MonumentSettingDocument,
    WorkOrder,
    Schedule,
    MemorialRequest,
  } = models;
  if (!MonumentSettingRequest?.findAll || !WorkOrder?.findOrCreate || !Schedule?.findOne) return;

  const settingRequests = await MonumentSettingRequest.findAll({
    where: { linkedMemorialRequestId: { [Op.ne]: null } },
    attributes: [
      'id',
      'linkedMemorialRequestId',
      'clientAccountId',
      'requestNumber',
      'status',
      'scheduledDate',
      'assignedSettingCompany',
      'assignedCoordinator',
      'serviceNotes',
      'completedAt',
    ],
  });

  for (const setting of settingRequests) {
    const request = await MemorialRequest.findByPk(setting.linkedMemorialRequestId);
    if (!request) continue;
    if (MonumentSettingDocument?.update) {
      await MonumentSettingDocument.update(
        { requestId: request.id },
        { where: { monumentSettingRequestId: setting.id, requestId: null } },
      );
    }
    const [workOrder] = await WorkOrder.findOrCreate({
      where: { requestId: request.id },
      defaults: {
        requestId: request.id,
        clientAccountId: request.clientAccountId || setting.clientAccountId,
        workOrderNumber: `WO-${setting.requestNumber || request.requestNumber || request.id}`,
        status: setting.status || 'PENDING',
        assignedTechnicianName: setting.assignedSettingCompany || setting.assignedCoordinator,
        serviceNotes: setting.serviceNotes || null,
        completedAt: setting.completedAt || null,
      },
    });

    if (!setting.scheduledDate) continue;
    const existing = await Schedule.findOne({
      where: { requestId: request.id, scheduledDate: setting.scheduledDate },
    });
    if (!existing) {
      await Schedule.create({
        requestId: request.id,
        workOrderId: workOrder.id,
        clientAccountId: request.clientAccountId || setting.clientAccountId,
        scheduledDate: setting.scheduledDate,
        technicianName: setting.assignedSettingCompany || setting.assignedCoordinator,
        status: setting.status || 'SCHEDULED',
        notes: setting.serviceNotes || null,
      });
    }
  }
}

async function ensureCoreDataObjects(sequelize, models) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = normalizeTables(await queryInterface.showAllTables());
  await addColumns(queryInterface, tables);

  // New models are synced before this boot migration. These backfills make
  // the explicit objects useful for existing deployments as well.
  await backfillApprovalEvents(models);
  await backfillPayments(models);
  await backfillOperations(models);
}

module.exports = ensureCoreDataObjects;
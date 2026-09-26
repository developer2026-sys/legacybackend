'use strict';

const { DataTypes, QueryTypes } = require('sequelize');
const {
  REQUEST_STATUSES,
  LEGACY_STATUS_MAP,
  normalizeLegacyRequestStatus,
} = require('../utils/requestStatus');

async function ensureRequestStatuses(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = (await queryInterface.showAllTables()).map((table) =>
    typeof table === 'string' ? table.toLowerCase() : String(table.tableName || table).toLowerCase()
  );
  if (!tables.includes('memorial_requests')) return;

  const columns = await queryInterface.describeTable('memorial_requests');
  if (!columns.status) return;
  if (!/varchar/i.test(String(columns.status.type))) {
    await queryInterface.changeColumn('memorial_requests', 'status', {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DRAFT',
    });
  }

  const rows = await sequelize.query(
    'SELECT id, status, admin_notes FROM memorial_requests',
    { type: QueryTypes.SELECT }
  );
  for (const row of rows) {
    const normalized = String(row.status ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
    const status = normalizeLegacyRequestStatus(row.status);
    const isKnown = REQUEST_STATUSES.includes(normalized) || Object.hasOwn(LEGACY_STATUS_MAP, normalized);
    const values = { status };
    if (!isKnown && row.status) {
      const preservedNote = `Legacy status migrated: "${row.status}".`;
      values.admin_notes = row.admin_notes
        ? `${row.admin_notes}\n${preservedNote}`
        : preservedNote;
    }
    if (row.status !== status || values.admin_notes !== undefined) {
      await queryInterface.bulkUpdate('memorial_requests', values, { id: row.id });
    }
  }
}

module.exports = ensureRequestStatuses;
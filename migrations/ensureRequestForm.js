'use strict';

const { DataTypes } = require('sequelize');

const REQUEST_COLUMNS = {
  submitted_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  request_number: { type: DataTypes.STRING(40), allowNull: true },
  submitted_at: { type: DataTypes.DATE, allowNull: true },
  draft_pricing_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
};

async function ensureRequestForm(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = (await queryInterface.showAllTables()).map((table) =>
    typeof table === 'string' ? table.toLowerCase() : String(table.tableName || table).toLowerCase()
  );
  if (!tables.includes('memorial_requests')) return;

  let description = await queryInterface.describeTable('memorial_requests');
  for (const [column, definition] of Object.entries(REQUEST_COLUMNS)) {
    if (!description[column]) {
      await queryInterface.addColumn('memorial_requests', column, definition);
    }
  }
  if (description.status && !/varchar/i.test(String(description.status.type))) {
    await queryInterface.changeColumn('memorial_requests', 'status', {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'DRAFT',
    });
  }

  const indexes = await queryInterface.showIndex('memorial_requests');
  const requestNumberIsUnique = indexes.some((index) =>
    index.unique && index.fields?.some((field) =>
      field.attribute === 'request_number' || field.name === 'request_number'
    )
  );
  if (!requestNumberIsUnique) {
    await queryInterface.addIndex('memorial_requests', ['request_number'], {
      name: 'memorial_requests_request_number_unique',
      unique: true,
    });
  }

  if (tables.includes('client_accounts')) {
    const clientColumns = await queryInterface.describeTable('client_accounts');
    if (!clientColumns.request_photos_required) {
      await queryInterface.addColumn('client_accounts', 'request_photos_required', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  }
}

module.exports = ensureRequestForm;
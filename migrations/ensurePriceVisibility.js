'use strict';

const { DataTypes } = require('sequelize');

const VISIBILITY_COLUMNS = {
  family_advisor_price_visibility: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'none',
  },
  client_admin_price_visibility: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'none',
  },
};

async function ensurePriceVisibility(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = (await queryInterface.showAllTables()).map((table) =>
    typeof table === 'string'
      ? table.toLowerCase()
      : String(table.tableName || table).toLowerCase()
  );
  if (!tables.includes('client_accounts')) return;

  const description = await queryInterface.describeTable('client_accounts');
  for (const [column, definition] of Object.entries(VISIBILITY_COLUMNS)) {
    if (!description[column]) {
      await queryInterface.addColumn('client_accounts', column, definition);
    } else {
      await sequelize.query(
        `UPDATE client_accounts SET ${column} = 'none' WHERE ${column} IS NULL OR ${column} NOT IN ('none', 'customer_retail', 'restoration')`
      );
    }
  }
}

module.exports = ensurePriceVisibility;
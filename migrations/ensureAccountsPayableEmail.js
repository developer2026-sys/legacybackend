'use strict';

const { DataTypes } = require('sequelize');

async function ensureAccountsPayableEmail(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = (await queryInterface.showAllTables()).map((table) =>
    typeof table === 'string' ? table.toLowerCase() : String(table.tableName || table).toLowerCase()
  );
  if (!tables.includes('client_accounts')) return;

  const columns = await queryInterface.describeTable('client_accounts');
  if (!columns.accounts_payable_email) {
    await queryInterface.addColumn('client_accounts', 'accounts_payable_email', {
      type: DataTypes.STRING(255),
      allowNull: true,
    });
  }
}

module.exports = ensureAccountsPayableEmail;
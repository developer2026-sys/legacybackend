// Compares every Sequelize model's defined attributes against the live DB schema
// and prints (or applies) the ALTER TABLE statements needed to catch the DB up.
//
// Usage:
//   node scripts/syncSchema.js           -> dry run, just prints what's missing
//   node scripts/syncSchema.js --apply   -> actually runs the ALTER TABLE statements

const path = require('path');
const { sequelize } = require('../db'); // adjust if your db.js exports differently

async function loadModels() {
  // Sequelize models are usually registered onto sequelize.models once your
  // model files are required somewhere (often via models/index.js).
  // Adjust this require path to match how your project loads models.
  require('../models'); // <-- change if models are loaded differently
  return sequelize.models;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const models = await loadModels();
  const queryInterface = sequelize.getQueryInterface();

  const modelNames = Object.keys(models);
  if (modelNames.length === 0) {
    console.error('No models found on sequelize.models — check the require path in loadModels().');
    process.exit(1);
  }

  let totalMissing = 0;

  for (const modelName of modelNames) {
    const model = models[modelName];
    const tableName = model.getTableName();
    const tableNameStr = typeof tableName === 'string' ? tableName : tableName.tableName;

    let existingColumns;
    try {
      existingColumns = await queryInterface.describeTable(tableNameStr);
    } catch (err) {
      console.warn(`⚠️  Could not describe table "${tableNameStr}" (model ${modelName}): ${err.message}`);
      continue;
    }

    const attributes = model.rawAttributes;
    const missing = [];

    for (const [attrName, attrDef] of Object.entries(attributes)) {
      const columnName = attrDef.field || attrName;
      if (!existingColumns[columnName]) {
        missing.push({ attrName, columnName, attrDef });
      }
    }

    if (missing.length > 0) {
      console.log(`\n=== ${modelName} (table: ${tableNameStr}) ===`);
      for (const { columnName, attrDef } of missing) {
        totalMissing++;
        const sql = queryInterface.queryGenerator.attributeToSQL(attrDef, {
          context: 'addColumn',
        });
        console.log(`  Missing column: ${columnName}`);
        console.log(`    -> ALTER TABLE \`${tableNameStr}\` ADD COLUMN \`${columnName}\` ${sql};`);

        if (apply) {
          try {
            await queryInterface.addColumn(tableNameStr, columnName, attrDef);
            console.log(`    ✅ added`);
          } catch (err) {
            console.error(`    ❌ failed to add: ${err.message}`);
          }
        }
      }
    }
  }

  console.log(`\nDone. ${totalMissing} missing column(s) found${apply ? ' and processed' : ' (dry run — rerun with --apply to add them)'}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
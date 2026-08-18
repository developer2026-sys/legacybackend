// db.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('lasting_legacy_cleaner', 'root', '', {
  host: 'localhost',
  dialect: 'mysql',
  port: 3306,
});

module.exports = sequelize;
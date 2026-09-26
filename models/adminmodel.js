'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    emailRemindersEnabled: {
        type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
            field: 'email_reminders_enabled',
          },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'super_admin',
    },
  }, {
    tableName: 'admins',
    timestamps: true,
    underscored: true,
  });

  return { Admin };
};
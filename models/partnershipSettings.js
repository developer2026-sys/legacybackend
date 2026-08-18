'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PartnershipSettings = sequelize.define('PartnershipSettings', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    partnerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'partner_id',
    },
    annualGoal: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 500,
      field: 'annual_goal',
    },
    emailRemindersEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'email_reminders_enabled',
    },
    emailSendTime: {
      type: DataTypes.STRING(5), // 'HH:MM'
      allowNull: false,
      defaultValue: '07:00',
      field: 'email_send_time',
    },
    lastReminderSentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: 'last_reminder_sent_date',
    },
  }, {
    tableName: 'partnership_settings',
    timestamps: true,
    underscored: true,
  });

  return { PartnershipSettings };
};
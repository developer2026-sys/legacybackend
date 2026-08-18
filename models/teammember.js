'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TeamMember = sequelize.define('TeamMember', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    admin_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    invited_by_admin_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'admins',
        key: 'id',
      },
    },
  }, {
    tableName: 'team_members',
    timestamps: true,
    underscored: true,
  });

  TeamMember.associate = (models) => {
    TeamMember.belongsTo(models.Admin, {
      foreignKey: 'admin_id',
      as: 'admin',
    });

    TeamMember.belongsTo(models.Admin, {
      foreignKey: 'invited_by_admin_id',
      as: 'invitedByAdmin',
    });
  };

  return { TeamMember };
};
  'use strict';

  const { DataTypes } = require('sequelize');

  module.exports = (sequelize) => {
    const PartnerTeamMember = sequelize.define('PartnerTeamMember', {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      partner_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'partners',
          key: 'id',
        },
      },
      invited_by_partner_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'partners',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'denied'),
        allowNull: false,
        defaultValue: 'pending',
      },
      approved_by_admin_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'admins',
          key: 'id',
        },
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    }, {
      tableName: 'partner_team_members',
      timestamps: true,
      underscored: true,
    });

    PartnerTeamMember.associate = (models) => {
      PartnerTeamMember.belongsTo(models.Partner, {
        foreignKey: 'partner_id',
        as: 'partner',
      });

      PartnerTeamMember.belongsTo(models.Partner, {
        foreignKey: 'invited_by_partner_id',
        as: 'invitedByPartner',
      });

      PartnerTeamMember.belongsTo(models.Admin, {
        foreignKey: 'approved_by_admin_id',
        as: 'approvedByAdmin',
      });
    };

    return { PartnerTeamMember };
  };
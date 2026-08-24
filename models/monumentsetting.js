'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

  const MonumentSettingRequest = sequelize.define('MonumentSettingRequest', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    requestNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // e.g. MSR-000001
    },
    partnerId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    // Partner info (order refs — company/contact info comes from Partner association)
    partnerOrderNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    internalReferenceNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Family info
    familyFirstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyLastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyPhone: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyEmail: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyState: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    familyZip: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    preferredContact: {
      type: DataTypes.ENUM('phone', 'text', 'email'),
      allowNull: false,
      defaultValue: 'phone',
    },
    allowFamilyContact: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Cemetery info
    cemeteryName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cemeteryAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cemeteryCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cemeteryState: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    cemeteryZip: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    territory: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cemeteryContactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cemeteryPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cemeteryEmail: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    section: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lot: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    graveSpace: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cemeteryApproval: {
      type: DataTypes.ENUM('yes', 'no', 'pending', 'unknown'),
      allowNull: false,
      defaultValue: 'unknown',
    },

    // Monument info
    monumentType: {
      type: DataTypes.ENUM(
        'upright',
        'flat_marker',
        'slant',
        'bevel',
        'bench',
        'companion',
        'cremation_memorial',
        'other'
      ),
      allowNull: true,
    },
    material: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    width: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    height: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    depth: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    approximateWeight: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    baseDimensions: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    numberOfPieces: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    settingRequested: {
      type: DataTypes.ENUM(
        'setting_only',
        'foundation_and_setting',
        'reset_existing_monument',
        'existing_foundation',
        'new_foundation_required',
        'removal_and_reset',
        'site_evaluation_needed',
        'other'
      ),
      allowNull: true,
    },

    // Monument current location / pickup
    monumentLocationType: {
      type: DataTypes.ENUM(
        'monument_company',
        'manufacturer',
        'cemetery',
        'storage_facility',
        'family',
        'other'
      ),
      allowNull: true,
    },
    pickupAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pickupContactName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    pickupPhone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    readyForPickup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    requestedPickupDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // Requested setting schedule
    requestedSettingDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    alternateDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    deadlineDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    flexibleDates: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    deadlineReason: {
      type: DataTypes.ENUM(
        'funeral_service',
        'anniversary',
        'family_request',
        'cemetery_requirement',
        'other'
      ),
      allowNull: true,
    },
    specialInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Memorial Preventative Care
    carePackageOption: {
      type: DataTypes.ENUM('care_549', 'care_749', 'care_none'),
      allowNull: true,
    },
    careFamilyStatus: {
      type: DataTypes.ENUM(
        'purchased_549',
        'purchased_749',
        'interested_contact_them',
        'information_requested',
        'declined',
        'not_discussed_yet'
      ),
      allowNull: true,
      defaultValue: 'not_discussed_yet',
    },
    linkedMemorialRequestId: {
      // ties the sold care package to the family's existing MemorialRequest/customer record
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    // Status / pipeline tracking
    status: {
      type: DataTypes.ENUM(
        'new',
        'under_review',
        'cemetery_verification',
        'quote_pending',
        'awaiting_approval',
        'approved',
        'scheduling',
        'scheduled',
        'in_progress',
        'completed',
        'on_hold',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'new',
    },
    quoteAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    scheduledDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    assignedSettingCompany: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    assignedCoordinator: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'monument_setting_requests',
    timestamps: true,
    underscored: true,
  });

  const MonumentSettingDocument = sequelize.define('MonumentSettingDocument', {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    monumentSettingRequestId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
    documentType: {
      type: DataTypes.ENUM(
        'monument_front_photo',
        'monument_back_photo',
        'base_photo',
        'drawing_dimensions',
        'cemetery_plot_info',
        'foundation_photo',
        'cemetery_approval',
        'work_order',
        'additional'
      ),
      allowNull: false,
      defaultValue: 'additional',
    },
    storagePath: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  }, {
    tableName: 'monument_setting_documents',
    timestamps: true,
    underscored: true,
  });

  MonumentSettingRequest.hasMany(MonumentSettingDocument, {
    foreignKey: 'monumentSettingRequestId',
    as: 'documents',
  });
  MonumentSettingDocument.belongsTo(MonumentSettingRequest, {
    foreignKey: 'monumentSettingRequestId',
    as: 'request',
  });

  return { MonumentSettingRequest, MonumentSettingDocument };
};
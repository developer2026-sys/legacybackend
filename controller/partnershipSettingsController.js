'use strict';

function partnershipSettingsController(models) {
  const { Partner, PartnershipSettings, MemorialRequest } = require('../models');

  const getSettings = async (req, res) => {
    try {
      const partnerId = req.params.id;
      const partner = await Partner.findByPk(partnerId);
      if (!partner) return res.status(404).json({ message: 'Partner not found.' });

      const [settings] = await PartnershipSettings.findOrCreate({
        where: { partnerId, clientAccountId: partner.clientAccountId },
        defaults: { partnerId, clientAccountId: partner.clientAccountId },
      });

      const { Op } = require('sequelize');

      const year = new Date().getFullYear();
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year + 1, 0, 1);
      
      const completedMemorials = await MemorialRequest.count({
        where: {
          partnerId: req.params.id,
          status: 'APPROVED', 
          approvedAt: { [Op.gte]: yearStart, [Op.lt]: yearEnd },
        },
      });
      
      res.json({ settings, completedMemorials });
    } catch (err) {
      console.error('getSettings error:', err);
      res.status(500).json({ message: 'Failed to load partner settings.' });
    }
  };

  const updateSettings = async (req, res) => {
    try {
      const partnerId = req.params.id;
      const { annualGoal, emailRemindersEnabled, emailSendTime } = req.body;

      if (annualGoal !== undefined && (isNaN(annualGoal) || annualGoal <= 0)) {
        return res.status(400).json({ message: 'annualGoal must be a positive number.' });
      }
      if (emailSendTime !== undefined && !/^\d{2}:\d{2}$/.test(emailSendTime)) {
        return res.status(400).json({ message: 'emailSendTime must be in HH:MM format.' });
      }

      const partner = await Partner.findByPk(partnerId);
      if (!partner) return res.status(404).json({ message: 'Partner not found.' });

      const [settings] = await PartnershipSettings.findOrCreate({
        where: { partnerId, clientAccountId: partner.clientAccountId },
        defaults: { partnerId, clientAccountId: partner.clientAccountId },
      });

      await settings.update({
        ...(annualGoal !== undefined && { annualGoal }),
        ...(emailRemindersEnabled !== undefined && { emailRemindersEnabled }),
        ...(emailSendTime !== undefined && { emailSendTime }),
      });

      res.json({ settings });
    } catch (err) {
      console.error('updateSettings error:', err);
      res.status(500).json({ message: 'Failed to update partner settings.' });
    }
  };

  return { getSettings, updateSettings };
}

module.exports = partnershipSettingsController;
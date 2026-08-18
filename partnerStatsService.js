'use strict';

const { Partner, MemorialRequest } = require('./models');
const calculatePartnerStats = async (partnerId) => {
  try {
    const partner = await Partner.findByPk(partnerId, {
      include: {
        association: 'requests',
        attributes: ['id', 'status', 'packageType'],
      },
    });

    if (!partner) {
      throw new Error(`Partner with ID ${partnerId} not found`);
    }

    const requests = partner.requests || [];

    // Count packages by type (only completed ones count toward revenue)
    const countableStatuses = ['completed', 'approved'];

const basicCount = requests.filter(
  (r) => countableStatuses.includes(r.status) && r.packageType === 'basic_annual'
).length;

const premiumCount = requests.filter(
  (r) => countableStatuses.includes(r.status) && r.packageType === 'premium_annual'
).length;
    const soldCount = basicCount + premiumCount;

    // Revenue calculations
    const basicRevenue = basicCount * 100;
    const premiumRevenue = premiumCount * 150;
    const totalRevenue = basicRevenue + premiumRevenue;

    // Activity counts
    const activeRequests = requests.filter(
      (r) => r.status === 'pending_approval' || r.status === 'approved'
    ).length;

    const completedRequests = requests.filter(
      (r) => r.status === 'completed'
    ).length;

    const pendingRequests = requests.filter(
      (r) => r.status === 'pending_approval'
    ).length;

    // Get partnership settings (annual goal)
    const partnershipSettings = await partner.getPartnershipSettings();
    const annualGoal = partnershipSettings ? partnershipSettings.annualGoal : 500;

    const remainingCount = Math.max(0, annualGoal - soldCount);
    const progressPercent = Math.min(100, (soldCount / annualGoal) * 100);

    return {
      partnerId,
      partnerName: partner.contactName || partner.username,
      partnerEmail: partner.email,
      soldCount,
      annualGoal,
      remainingCount,
      progressPercent,
      basicCount,
      basicRevenue,
      premiumCount,
      premiumRevenue,
      totalRevenue,
      activeRequests,
      completedRequests,
      pendingRequests,
    };
  } catch (error) {
    console.error(`Error calculating stats for partner ${partnerId}:`, error);
    throw error;
  }
};

module.exports = {
  calculatePartnerStats,
};
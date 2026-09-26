'use strict';

const { Partner, MemorialRequest } = require('./models');
const calculatePartnerStats = async (partnerId) => {
  try {
    const partner = await Partner.findByPk(partnerId, {
      include: {
        association: 'requests',
        attributes: [
          'id',
          'status',
          'packageType',
          'packageNameSnapshot',
          'packagePrice',
          'restorationPrice',
          'revenueShare',
        ],
        include: [{ association: 'package', attributes: ['name'] }],
      },
    });

    if (!partner) {
      throw new Error(`Partner with ID ${partnerId} not found`);
    }

    const requests = partner.requests || [];

    // Use the values captured on each request, not today's price table.
    const countableStatuses = ['COMPLETED', 'APPROVED'];
    const soldRequests = requests.filter((request) => countableStatuses.includes(request.status));
    const soldCount = soldRequests.length;
    const packageBreakdown = Array.from(soldRequests.reduce((groups, request) => {
      const name = request.packageNameSnapshot || request.package?.name || request.packageType || 'Package';
      const group = groups.get(name) || {
        name,
        count: 0,
        restorationTotal: 0,
        revenueShareTotal: 0,
      };
      group.count += 1;
      group.restorationTotal += Number(request.restorationPrice ?? request.packagePrice ?? 0);
      group.revenueShareTotal += Number(request.revenueShare || 0);
      groups.set(name, group);
      return groups;
    }, new Map()).values());
    const totalRevenue = packageBreakdown.reduce((sum, item) => sum + item.revenueShareTotal, 0);

    // Activity counts
    const activeRequests = requests.filter(
      (r) => !['DRAFT', 'REJECTED', 'COMPLETED', 'CANCELLED'].includes(r.status)
    ).length;

    const completedRequests = requests.filter(
      (r) => r.status === 'COMPLETED'
    ).length;

    const pendingRequests = requests.filter(
      (r) => ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION'].includes(r.status)
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
      packageBreakdown,
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
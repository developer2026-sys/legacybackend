'use strict';

const PRICE_VISIBILITIES = new Set(['none', 'customer_retail', 'restoration']);
const PRICE_FIELDS = new Set([
  'customerRetailPrice',
  'customer_retail_price',
  'retailPrice',
  'retail_price',
  'packagePrice',
  'package_price',
  'restorationPrice',
  'restoration_price',
  'invoiceAmount',
  'invoice_amount',
  'revenueShare',
  'revenue_share',
  'revenueShareTotal',
  'revenue_share_total',
  'totalRevenue',
  'total_revenue',
]);

const isFamilyAdvisor = (req) =>
  req?.accountRole === 'family_advisor'
  || req?.userRole === 'family_advisor'
  || req?.partner?.accountRole === 'family_advisor';

async function getPriceVisibility(req, ClientAccount) {
  const familyAdvisor = isFamilyAdvisor(req);
  const field = familyAdvisor
    ? 'familyAdvisorPriceVisibility'
    : 'clientAdminPriceVisibility';
  const account = await ClientAccount.findByPk(req.clientAccountId, {
    attributes: [field],
  });
  const configured = account?.[field];
  console.log('[price-visibility]', { clientAccountId: req.clientAccountId, field, configured, accountRole: req.accountRole });

  return {
    mode: PRICE_VISIBILITIES.has(configured) ? configured : 'none',
    familyAdvisor,
  };
}

function serializeWithPriceVisibility(value, visibility = {}) {
  const mode = PRICE_VISIBILITIES.has(visibility.mode) ? visibility.mode : 'none';
  const familyAdvisor = Boolean(visibility.familyAdvisor);

  const visit = (input) => {
    if (input == null || typeof input !== 'object') return input;
    if (input instanceof Date) return input;

    const original = typeof input.toJSON === 'function' ? input.toJSON() : input;
    if (Array.isArray(original)) return original.map(visit);

    const output = {};
    for (const [key, child] of Object.entries(original)) {
      if (PRICE_FIELDS.has(key)) continue;
      output[key] = visit(child);
    }

    if (mode === 'customer_retail') {
      const amount = original.customerRetailPrice
        ?? original.customer_retail_price
        ?? original.retailPrice
        ?? original.retail_price
        ?? original.packagePrice
        ?? original.package_price
        ?? original.restorationPrice
        ?? original.restoration_price;
      if (amount !== undefined && amount !== null) output.customerRetailPrice = amount;
    } else if (mode === 'restoration') {
      const amount = original.restorationPrice
        ?? original.restoration_price
        ?? original.packagePrice
        ?? original.package_price
        ?? original.customerRetailPrice
        ?? original.customer_retail_price;
      if (amount !== undefined && amount !== null) output.restorationPrice = amount;
    }

    // Client Admins retain their existing invoice view when they have opted
    // into price visibility. Family Advisors never receive invoice amounts.
    if (!familyAdvisor && mode !== 'none') {
      const invoiceAmount = original.invoiceAmount ?? original.invoice_amount;
      if (invoiceAmount !== undefined && invoiceAmount !== null) {
        output.invoiceAmount = invoiceAmount;
      }
    }

    return output;
  };

  return visit(value);
}

module.exports = {
  PRICE_VISIBILITIES,
  getPriceVisibility,
  serializeWithPriceVisibility,
};
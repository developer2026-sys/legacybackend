'use strict';

async function ensureInvoices(models) {
  const { Invoice, MemorialRequest } = models;
  if (!Invoice || !MemorialRequest) return;

  const requests = await MemorialRequest.findAll({
    where: { status: ['INVOICE_PENDING', 'PAYMENT_PENDING'] },
    attributes: ['id', 'clientAccountId', 'invoiceAmount', 'packagePrice'],
  });

  for (const request of requests) {
    await Invoice.findOrCreate({
      where: { requestId: request.id },
      defaults: {
        requestId: request.id,
        clientAccountId: request.clientAccountId,
        amount: request.invoiceAmount ?? request.packagePrice,
        customerRetailAmount: request.packagePrice,
        restorationAmount: request.restorationPrice,
        revenueShareAmount: request.revenueShare,
        pricingEffectiveDate: request.pricingEffectiveDate,
        pricingSnapshot: {
          packageId: request.packageId,
          packageName: request.packageNameSnapshot,
          customerRetailAmount: request.packagePrice,
          restorationAmount: request.restorationPrice,
          revenueShareAmount: request.revenueShare,
          invoiceAmount: request.invoiceAmount ?? request.packagePrice,
          effectiveDate: request.pricingEffectiveDate,
        },
        paymentStatus: 'PENDING',
      },
    });
  }
}

module.exports = ensureInvoices;
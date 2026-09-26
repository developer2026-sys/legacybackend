'use strict';

const createPricingController = (models) => {
  const {
    ClientAccount,
    Location,
    PricingPackage,
    PricingConfiguration,
  } = models;

  const list = async (_req, res) => {
    try {
      const [accounts, packages, pricing] = await Promise.all([
        ClientAccount.findAll({
          include: [{ model: Location, as: 'locations' }],
          order: [['name', 'ASC']],
        }),
        PricingPackage.findAll({ order: [['name', 'ASC']] }),
        PricingConfiguration.findAll({
          include: [
            { model: ClientAccount, as: 'clientAccount', attributes: ['id', 'name'] },
            { model: Location, as: 'location', attributes: ['id', 'name'] },
            { model: PricingPackage, as: 'package', attributes: ['id', 'name', 'key'] },
          ],
          order: [['effective_date', 'DESC'], ['created_at', 'DESC']],
        }),
      ]);
      return res.json({ accounts, packages, pricing });
    } catch (err) {
      console.error('[pricing.list]', err);
      return res.status(500).json({ message: 'Unable to load pricing configuration.' });
    }
  };

  const save = async (req, res) => {
    try {
      const {
        clientAccountId,
        locationId,
        packageId,
        packageName,
        restorationPrice,
        revenueShare,
        effectiveDate,
      } = req.body;

      const clientId = Number(clientAccountId);
      const propertyId = Number(locationId);
      const price = Number(restorationPrice);
      const share = Number(revenueShare);
      const dateText = String(effectiveDate || '');
      if (!Number.isInteger(clientId) || !Number.isInteger(propertyId)) {
        return res.status(400).json({ message: 'Select a client and property.' });
      }
      if (!Number.isFinite(price) || price < 0 || !Number.isFinite(share) || share < 0 || share > price) {
        return res.status(400).json({ message: 'Enter valid amounts; revenue share cannot exceed restoration price.' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)
        || new Date(`${dateText}T00:00:00.000Z`).toISOString().slice(0, 10) !== dateText) {
        return res.status(400).json({ message: 'Enter a valid effective date.' });
      }

      const property = await Location.findOne({
        where: { id: propertyId, clientAccountId: clientId },
      });
      if (!property) return res.status(400).json({ message: 'That property does not belong to the selected client.' });

      let pricingPackage;
      if (packageId) {
        pricingPackage = await PricingPackage.findByPk(Number(packageId));
        if (!pricingPackage) return res.status(400).json({ message: 'Select a valid package.' });
      } else {
        const name = String(packageName || '').trim();
        if (!name) return res.status(400).json({ message: 'Choose a package or enter a new package name.' });
        if (name.length > 255) return res.status(400).json({ message: 'Package name must be 255 characters or fewer.' });

        pricingPackage = await PricingPackage.findOne({ where: { name } });
        if (!pricingPackage) {
          const baseKey = name.toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 100) || 'package';
          let key = baseKey;
          let suffix = 2;
          while (await PricingPackage.findOne({ where: { key } })) {
            key = `${baseKey.slice(0, 112)}_${suffix++}`;
          }
          pricingPackage = await PricingPackage.create({ name, key });
        }
      }

      // Always append a new effective-dated row; past requests and prior
      // configuration history are never rewritten.
      const row = await PricingConfiguration.create({
        clientAccountId: clientId,
        locationId: propertyId,
        packageId: pricingPackage.id,
        restorationPrice: price.toFixed(2),
        revenueShare: share.toFixed(2),
        effectiveDate: dateText,
      });
      const saved = await PricingConfiguration.findByPk(row.id, {
        include: [
          { model: ClientAccount, as: 'clientAccount', attributes: ['id', 'name'] },
          { model: Location, as: 'location', attributes: ['id', 'name'] },
          { model: PricingPackage, as: 'package', attributes: ['id', 'name', 'key'] },
        ],
      });
      return res.status(201).json({ pricing: saved });
    } catch (err) {
      console.error('[pricing.save]', err);
      return res.status(500).json({ message: 'Unable to save pricing configuration.' });
    }
  };

  return { list, save };
};

module.exports = createPricingController;
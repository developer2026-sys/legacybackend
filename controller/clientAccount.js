'use strict';

const { ClientAccount, Location, Partner } = require('../models');

const getMyAccount = async (req, res) => {
  const account = await ClientAccount.findByPk(req.clientAccountId, {
    include: [
      { model: Location, as: 'locations' },
      {
        model: Partner,
        as: 'members',
        attributes: ['id', 'username', 'email', 'contactName', 'accountRole'],
      },
    ],
  });
  if (!account) return res.status(404).json({ message: 'Client account not found.' });
  return res.json({ account });
};

const getMyLocations = async (req, res) => {
  const locations = await Location.findAll({
    where: { clientAccountId: req.clientAccountId, status: 'active' },
    order: [['name', 'ASC']],
  });
  return res.json({ locations });
};

const createLocation = async (req, res) => {
  const { name, address, city, state, zip } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: 'Location name is required.' });
  }
  const location = await Location.create({
    clientAccountId: req.clientAccountId,
    name: String(name).trim(),
    address: address || null,
    city: city || null,
    state: state || null,
    zip: zip || null,
    status: 'active',
  });
  return res.status(201).json({ location });
};

module.exports = { getMyAccount, getMyLocations, createLocation };
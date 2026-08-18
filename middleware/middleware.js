'use strict';

const jwt = require('jsonwebtoken');
const { Partner } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const partner = await Partner.findByPk(decoded.id);
    if (!partner) {
      return res.status(401).json({ message: 'Unauthorized.' });
    }

    req.partner = partner;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
};

module.exports = authenticate;
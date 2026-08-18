'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { Partner, PartnerTeamMember, PartnershipSettings } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET;
// REGISTER
const register = async (req, res) => {
  try {
    const { username, password, role, fullName, organization, phone } = req.body;
    const email = username; // frontend sends email as username

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const existing = await Partner.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const partner = await Partner.create({
      username: email,
      email,
      password: passwordHash,
      role: role === 'admin' ? 'admin' : 'partner',
      fullName,
      organization,
      phone,
    });

    await PartnershipSettings.create({
      partnerId: partner.id,
      emailRemindersEnabled: true,
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      partner: { id: partner.id, username: partner.username, role: partner.role },
    });

  } catch (err) {
    console.log(err.message)
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// LOGIN
// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const partner = await Partner.findOne({ where: { email } });

    if (!partner) {
      console.log('❌ No partner found for email:', email);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    console.log('✅ Partner found:', partner.email);
    console.log('🔑 Password from DB:', partner.password);

    const isMatch = await bcrypt.compare(password, partner.password);
    console.log('🔐 Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // If this partner was invited as a team member, gate login on approval status
    const teamMembership = await PartnerTeamMember.findOne({ where: { partner_id: partner.id } });
    if (teamMembership) {
      if (teamMembership.status === 'pending') {
        return res.status(403).json({ message: 'Your account is pending admin approval.' });
      }
      if (teamMembership.status === 'denied') {
        return res.status(403).json({ message: 'Your account access has been denied.' });
      }
    }

    console.log('🔑 JWT_SECRET:', JWT_SECRET);
    const token = jwt.sign(
      { id: partner.id, role: partner.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      partner: { id: partner.id, username: partner.username, role: partner.role },
    });
  } catch (err) {
    console.log('💥 Login error:', err.message);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};


// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
      const { email, newPassword } = req.body;
  
      if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required.' });
      }
  
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
  
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
  
  const partner = await Partner.findOne({ where: { email } });
      if (!partner) {
        return res.status(404).json({ message: 'No account found with that email.' });
      }
  
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await partner.update({ password: passwordHash });
  
      return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: 'Server error.', error: err.message });
    }
  };



  const invitePartnerTeamMember = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });
  
    const partnerId = req.partner.id;
  
    // Block invited sub-partners from inviting others — only root partners may invite
    const isSubPartner = await PartnerTeamMember.findOne({ where: { partner_id: partnerId } });
    if (isSubPartner)
      return res.status(403).json({ message: 'Only partners are allowed to invite team members.' });
  
    // Check how many team members this partner has already invited
  // Check how many team members this partner has already invited
  // (denied invites don't count against the limit — their slot is freed up)
  const inviteCount = await PartnerTeamMember.count({
    where: {
      invited_by_partner_id: partnerId,
      status: { [Op.ne]: 'denied' },
    },
  });
  if (inviteCount >= 3)
    return res.status(403).json({ message: 'You have reached the maximum limit of 3 team members.' });
    // Check if a partner with this email already exists
    const existingPartner = await Partner.findOne({ where: { email } });
    if (existingPartner)
      return res.status(409).json({ message: 'An account with that email already exists.' });
  
    // Check if a team member with this email already exists
    const existingMember = await PartnerTeamMember.findOne({
      include: [{ model: Partner, as: 'partner', where: { email }, attributes: [] }],
    });
    if (existingMember)
      return res.status(409).json({ message: 'A team member with that email already exists.' });
    const hashed = await bcrypt.hash(password, 12);
    const newPartner = await Partner.create({ username: email, email, password: hashed });

    await PartnershipSettings.create({
      partnerId: newPartner.id,
      emailRemindersEnabled: true,
    });

    const partnerTeamMember = await PartnerTeamMember.create({
      partner_id: newPartner.id,
      invited_by_partner_id: partnerId,
    });
    
  
    res.status(201).json({
      message: 'Team member invited successfully. Pending admin approval.',
      teamMember: {
        id: partnerTeamMember.id,
        partner_id: partnerTeamMember.partner_id,
        invited_by_partner_id: partnerTeamMember.invited_by_partner_id,
        email: newPartner.email,
        status: partnerTeamMember.status,
      },
    });
  }


  // GET /partner/team-members
// GET /partner/team-members
const getTeamMembers = async (req, res) => {
  try {
    const partnerId = req.partner.id; // adjust to match your auth middleware's attached field

    const teamMembers = await PartnerTeamMember.findAll({
      where: {
        invited_by_partner_id: partnerId,
        status: { [Op.ne]: 'denied' }, // hide denied members so their slot reappears as empty
      },
      include: [
        {
          model: Partner,
          as: 'partner',
          attributes: ['id', 'email', 'username', 'contactName'],
        },
        {
          model: Partner,
          as: 'invitedByPartner',
          attributes: ['id', 'email', 'username'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });

    return res.status(200).json({ teamMembers });
  } catch (err) {
    console.error('getTeamMembers error:', err);
    return res.status(500).json({ message: 'Failed to load team members.' });
  }
};



const checkPartnerRole = async (req, res) => {
  const partnerId = req.partner.id;

  const isTeamMember = await PartnerTeamMember.findOne({ where: { partner_id: partnerId } });

  res.json({
    partner: !isTeamMember,
    email: req.partner.email,
  });
}

module.exports = { register, login ,checkPartnerRole,getTeamMembers, resetPassword, invitePartnerTeamMember};
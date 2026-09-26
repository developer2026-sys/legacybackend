'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const {
  Partner,
  PartnerTeamMember,
  PartnershipSettings,
  ClientAccount,
  Location,
  UserStatusLog,
} = require('../models');
const JWT_SECRET = process.env.JWT_SECRET;

const makeSlug = (value) => String(value || 'client-account')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70) || 'client-account';

async function uniqueAccountSlug(name) {
  const base = makeSlug(name);
  let slug = base;
  let suffix = 2;
  while (await ClientAccount.findOne({ where: { slug } })) slug = `${base}-${suffix++}`;
  return slug;
}
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
    const clientAccount = await ClientAccount.create({
      name: `${organization || fullName || email} Account`,
      slug: await uniqueAccountSlug(organization || fullName || email),
      accountType: 'client',
      status: 'active',
    });
    await Location.create({
      clientAccountId: clientAccount.id,
      name: 'Primary Location',
      status: 'active',
    });

    const partner = await Partner.create({
      username: email,
      email,
      password: passwordHash,
      role: 'partner',
      accountRole: 'client_admin',
      status: 'pending_approval',
      clientAccountId: clientAccount.id,
      contactName: fullName || organization || email,
      phone,
    });
    await UserStatusLog.create({
      partnerId: partner.id,
      changedByType: 'system',
      oldStatus: null,
      newStatus: 'pending_approval',
      reason: 'New user registration.',
    });

    await PartnershipSettings.create({
      partnerId: partner.id,
      clientAccountId: clientAccount.id,
      emailRemindersEnabled: true,
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      partner: {
        id: partner.id,
        username: partner.username,
        role: partner.role,
        accountRole: partner.accountRole,
        status: partner.status,
        clientAccountId: partner.clientAccountId,
      },
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

    if (partner.status !== 'active') {
      return res.status(403).json({ message: `Account is ${partner.status || 'pending_approval'} and cannot log in.` });
    }

    const isMatch = await bcrypt.compare(password, partner.password);

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

    const token = jwt.sign(
      {
        id: partner.id,
        role: partner.role,
        accountRole: partner.accountRole,
        clientAccountId: partner.clientAccountId,
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      partner: {
        id: partner.id,
        username: partner.username,
        role: partner.role,
        accountRole: partner.accountRole,
        clientAccountId: partner.clientAccountId,
        phone: partner.phone,
        mustChangePassword: Boolean(partner.mustChangePassword),
      },
    });
  } catch (err) {
    console.log('💥 Login error:', err.message);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};


// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
      const { email, currentPassword, newPassword } = req.body;
  
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required.' });
      }
  
      if (email && String(email).trim().toLowerCase() !== String(req.partner.email || '').toLowerCase()) {
        return res.status(403).json({ message: 'You may only update your own password.' });
      }
  
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
  
      const partner = await Partner.findOne({
        where: { id: req.partner.id, clientAccountId: req.clientAccountId, status: 'active' },
      });
      if (!partner) {
        return res.status(401).json({ message: 'Unauthorized.' });
      }
      const valid = await bcrypt.compare(currentPassword, partner.password);
      if (!valid) return res.status(401).json({ message: 'Current password is incorrect.' });
  
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await partner.update({
        password: passwordHash,
        mustChangePassword: false,
      });
  
      return res.status(200).json({
        message: 'Password updated successfully.',
        mustChangePassword: false,
      });
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
  
    const clientAccountId = req.partner.clientAccountId;
    if (!clientAccountId) {
      return res.status(403).json({ message: 'Your account is not assigned to a client account.' });
    }
  
    // Check how many team members this partner has already invited
  // Check how many team members this partner has already invited
  // (denied invites don't count against the limit — their slot is freed up)
  const existingInvites = await PartnerTeamMember.findAll({
    where: {
      invited_by_partner_id: partnerId,
      client_account_id: clientAccountId,
      status: { [Op.ne]: 'denied' },
    },
    order: [['createdAt', 'ASC']],
  });

  // Keep only the latest request per invited partner, then drop anyone
  // whose latest request is an approved removal — that slot is freed.
  const latestByPartner = new Map();
  for (const invite of existingInvites) {
    latestByPartner.set(invite.partner_id, invite);
  }
  const activeInvites = [...latestByPartner.values()].filter((invite) => (
    !(invite.request_type === 'remove' && invite.status === 'approved')
  ));

  if (activeInvites.length >= 3)
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
    const memberRole = ['client_admin', 'family_advisor'].includes(req.body.role)
      ? req.body.role
      : 'family_advisor';
    const newPartner = await Partner.create({
      username: email,
      email,
      password: hashed,
      role: 'partner',
      accountRole: memberRole,
      mustChangePassword: memberRole === 'family_advisor',
      status: 'pending_approval',
      clientAccountId,
    });

    await UserStatusLog.create({
      partnerId: newPartner.id,
      changedByType: 'client_admin',
      changedById: partnerId,
      oldStatus: null,
      newStatus: 'pending_approval',
      reason: req.body.reason || 'User added by client admin.',
    });

    await PartnershipSettings.create({
      partnerId: newPartner.id,
      clientAccountId,
      emailRemindersEnabled: true,
    });

    const partnerTeamMember = await PartnerTeamMember.create({
      partner_id: newPartner.id,
      invited_by_partner_id: partnerId,
      client_account_id: clientAccountId,
      member_role: memberRole,
      request_type: 'add',
      reason: req.body.reason || 'User added by client admin.',
    });
    
  
    res.status(201).json({
      message: 'Team member invited successfully. Pending admin approval.',
      teamMember: {
        id: partnerTeamMember.id,
        partner_id: partnerTeamMember.partner_id,
        invited_by_partner_id: partnerTeamMember.invited_by_partner_id,
        email: newPartner.email,
        status: partnerTeamMember.status,
        member_role: partnerTeamMember.member_role,
        client_account_id: partnerTeamMember.client_account_id,
        userStatus: newPartner.status,
      },
    });
  }


  const requestPartnerStatusChange = async (req, res) => {
    const { partnerId } = req.params;
    const { action, reason } = req.body;
    if (!['deactivate', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'action must be deactivate or remove.' });
    }
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: 'A reason is required.' });
    }

    const target = await Partner.findOne({
      where: { id: partnerId, clientAccountId: req.partner.clientAccountId },
    });
    if (!target) return res.status(404).json({ message: 'Team member not found.' });
    if (target.id === req.partner.id) {
      return res.status(400).json({ message: 'You cannot request a status change for yourself.' });
    }
    if (target.status === 'inactive') {
      return res.status(409).json({ message: 'This user is already inactive.' });
    }

    const existing = await PartnerTeamMember.findOne({
      where: {
        partner_id: target.id,
        client_account_id: req.partner.clientAccountId,
        status: 'pending',
      },
    });
    if (existing) {
      return res.status(409).json({ message: 'This user already has a pending lifecycle request.' });
    }

    const request = await PartnerTeamMember.create({
      partner_id: target.id,
      invited_by_partner_id: req.partner.id,
      client_account_id: req.partner.clientAccountId,
      member_role: target.accountRole,
      request_type: action,
      reason: String(reason).trim(),
      status: 'pending',
    });

    return res.status(202).json({
      message: `${action} request submitted for Super Admin approval.`,
      request: {
        id: request.id,
        partner_id: request.partner_id,
        request_type: request.request_type,
        reason: request.reason,
        status: request.status,
      },
    });
  };

  // GET /partner/team-members
const getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await PartnerTeamMember.findAll({
      where: {
        client_account_id: req.partner.clientAccountId,
        status: { [Op.ne]: 'denied' }, // hide denied members so their slot reappears as empty
      },
      include: [
        {
          model: Partner,
          as: 'partner',
          where: { clientAccountId: req.partner.clientAccountId },
          required: true,
          attributes: ['id', 'email', 'username', 'contactName', 'accountRole', 'status'],
        },
        {
          model: Partner,
          as: 'invitedByPartner',
          where: { clientAccountId: req.partner.clientAccountId },
          required: false,
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
    accountRole: req.partner.accountRole,
    clientAccountId: req.partner.clientAccountId,
    mustChangePassword: Boolean(req.partner.mustChangePassword),
  });
}

module.exports = {
  register,
  login,
  checkPartnerRole,
  getTeamMembers,
  resetPassword,
  invitePartnerTeamMember,
  requestPartnerStatusChange,
};
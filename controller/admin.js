'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { TeamMember } = require('../models');
const fs = require('fs');
const teammember = require('../models/teammember');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('/tmp/public/files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[AdminController]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = (models) => {
  const { Admin, Partner, MemorialRequest, RequestPhoto, PartnerTeamMember, PartnershipSettings } = models;
  // ── AUTH ──────────────────────────────────────────────────────────────────

  const register = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const exists = await Admin.findOne({ where: { email } });
    if (exists)
      return res.status(409).json({ message: 'An admin with that email already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ email, password: hashed });

    res.status(201).json({ message: 'Admin account created.', admin: { id: admin.id, email: admin.email } });
  });

  const login = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email } });
  });

  const resetPassword = safe(async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ message: 'Email and newPassword are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: 'Admin not found.' });

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    res.json({ message: 'Password updated successfully.' });
  });

  // ── PARTNERS ──────────────────────────────────────────────────────────────

  const getAllPartners = safe(async (req, res) => {
    const partners = await Partner.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      include: [{
        model: PartnershipSettings,
        as: 'partnershipSettings',
        attributes: ['emailRemindersEnabled'],
      }],
      order: [['created_at', 'DESC']],
    });
    res.json({ partners });
  });


  const getPartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      include: [{
        model: MemorialRequest,
        as: 'requests',
        attributes: ['id', 'packageType', 'packagePrice', 'customerName', 'status', 'createdAt'],
      }],
    });
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    res.json({ partner });
  });

  const updatePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });

    const { username, email, role, password } = req.body;
    if (username !== undefined) partner.username = username;
    if (email !== undefined) partner.email = email;
    if (role !== undefined) {
      if (!['partner', 'admin'].includes(role))
        return res.status(400).json({ message: "Role must be 'partner' or 'admin'." });
      partner.role = role;
    }
    if (password) partner.password = await bcrypt.hash(password, 12);
    await partner.save();

    res.json({ message: 'Partner updated.', partner: { id: partner.id, username: partner.username, email: partner.email, role: partner.role } });
  });

  const deletePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    await partner.destroy();
    res.json({ message: 'Partner deleted.' });
  });

  // ── REQUESTS ──────────────────────────────────────────────────────────────

  const getAllRequests = safe(async (req, res) => {
    const requests = await MemorialRequest.findAll({
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ requests });
  });

  const getRequest = safe(async (req, res) => {
    const request = await MemorialRequest.findByPk(req.params.id, {
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath'] },
      ],
    });
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    res.json({ request });
  });

  const updateRequestStatus = safe(async (req, res) => {
    const { status, adminNotes } = req.body;
    const allowed = ['pending_approval', 'approved', 'completed', 'denied'];

    if (!allowed.includes(status))
      return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}.` });

    const request = await MemorialRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    // Use email directly from JWT — no Partner lookup needed
    const adminName = req.admin.email;

    request.status = status;
    if (adminNotes !== undefined) request.adminNotes = adminNotes;

    if (status === 'approved') {
      request.approvedBy = adminName;
      request.approvedAt = new Date();
      request.deniedBy   = null;
      request.deniedAt   = null;
    }
    if (status === 'denied') {
      request.deniedBy   = adminName;
      request.deniedAt   = new Date();
      request.approvedBy = null;
      request.approvedAt = null;
    }

    await request.save();

    res.json({
      message: 'Status updated.',
      request: {
        id:         request.id,
        status:     request.status,
        adminNotes: request.adminNotes,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt,
        deniedBy:   request.deniedBy,
        deniedAt:   request.deniedAt,
      },
    });
  });


  const updateRequestPrice = safe(async (req, res) => {
    const { packagePrice } = req.body;
  
    const parsedPrice = parseFloat(packagePrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: 'Invalid price.' });
    }
  
    const request = await MemorialRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
  
    request.packagePrice = parsedPrice;
    await request.save();
  
    res.json({
      message: 'Price updated.',
      request: {
        id: request.id,
        packagePrice: request.packagePrice,
      },
    });
  });

  // ── DOCUMENTS — must be an array, NOT wrapped in safe() ──────────────────

  const uploadDocuments = [
    upload.array('documents'),
    async (req, res) => {
      try {
        console.log('[uploadDocuments] called, files:', req.files?.length);
  
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: 'No files received.' });
        }
  
        const { id } = req.params;
  
        const request = await MemorialRequest.findByPk(id);
        if (!request) {
          return res.status(404).json({ message: 'Request not found.' });
        }
  
        // ← this part was missing from your debug version
        const records = await Promise.all(
          req.files.map(f => {
            const relativePath = path.relative(path.join(__dirname, '..'), f.path);
            console.log('[uploadDocuments] inserting:', relativePath);
            return RequestPhoto.create({ requestId: id, storagePath: relativePath });
          })
        );
  
        res.json({
          message: `${records.length} document(s) uploaded successfully.`,
          files: req.files.map(f => ({ originalName: f.originalname, filename: f.filename })),
          count: records.length,
        });
  
      } catch (e) {
        console.error('[uploadDocuments] error:', e);
        res.status(500).json({ message: e.message });
      }
    },
  ];



  const inviteTeamMember = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });
  
    const adminId = req.admin.id;
  
    // Block invited team members from inviting others — only root admins may invite
    const isTeamMember = await TeamMember.findOne({ where: { admin_id: adminId } });
    if (isTeamMember)
      return res.status(403).json({ message: 'Only admins are allowed to invite team members.' });
  
    // Check how many team members this admin has already invited
    const inviteCount = await TeamMember.count({
      where: { invited_by_admin_id: adminId },
    });
    if (inviteCount >= 3)
      return res.status(403).json({ message: 'You have reached the maximum limit of 3 team members.' });

    // Check if an admin with this email already exists
    const existingAdmin = await Admin.findOne({ where: { email } });
    if (existingAdmin)
      return res.status(409).json({ message: 'An account with that email already exists.' });
  
    // Check if a team member with this email already exists
    const existingMember = await TeamMember.findOne({
      include: [{ model: Admin, as: 'admin', where: { email }, attributes: [] }],
    });
    if (existingMember)
      return res.status(409).json({ message: 'A team member with that email already exists.' });
  
    const hashed = await bcrypt.hash(password, 12);
    const newAdmin = await Admin.create({ email, password: hashed });
  
    const teamMember = await TeamMember.create({
      admin_id: newAdmin.id,
      invited_by_admin_id: adminId,
    });
  
    res.status(201).json({
      message: 'Team member invited successfully.',
      teamMember: {
        id: teamMember.id,
        admin_id: teamMember.admin_id,
        invited_by_admin_id: teamMember.invited_by_admin_id,
        email: newAdmin.email,
      },
    });
  });

  const approvePartnerTeamMember = safe(async (req, res) => {
    const adminId = req.admin.id;
    const { id } = req.params;
  
    const member = await PartnerTeamMember.findByPk(id);
    if (!member)
      return res.status(404).json({ message: 'Team member not found.' });
  
    if (member.status === 'approved')
      return res.status(409).json({ message: 'This team member is already approved.' });
  
    member.status = 'approved';
    member.approved_by_admin_id = adminId;
    member.approved_at = new Date();
    await member.save();
  
    res.json({
      message: 'Team member approved successfully.',
      teamMember: {
        id: member.id,
        partner_id: member.partner_id,
        invited_by_partner_id: member.invited_by_partner_id,
        status: member.status,
        approved_by_admin_id: member.approved_by_admin_id,
        approved_at: member.approved_at,
      },
    });
  });
  
  const denyPartnerTeamMember = safe(async (req, res) => {
    const adminId = req.admin.id;
    const { id } = req.params;
  
    const member = await PartnerTeamMember.findByPk(id);
    if (!member)
      return res.status(404).json({ message: 'Team member not found.' });
  
    if (member.status === 'denied')
      return res.status(409).json({ message: 'This team member is already denied.' });
  
    member.status = 'denied';
    member.approved_by_admin_id = adminId;
    member.approved_at = new Date();
    await member.save();
  
    res.json({
      message: 'Team member denied successfully.',
      teamMember: {
        id: member.id,
        partner_id: member.partner_id,
        invited_by_partner_id: member.invited_by_partner_id,
        status: member.status,
        approved_by_admin_id: member.approved_by_admin_id,
        approved_at: member.approved_at,
      },
    });
  });
  
   
  const getTeamMembers = safe(async (req, res) => {
    const adminId = req.admin.id;
  
    const teamMembers = await TeamMember.findAll({
      where: { invited_by_admin_id: adminId },
      include: [{ model: Admin, as: 'admin', attributes: ['id', 'email'] }],
      order: [['created_at', 'DESC']],
    });
  
    res.json({ teamMembers });
  });


  const checkAdminRole = safe(async (req, res) => {
    const adminId = req.admin.id;
  
    const isTeamMember = await TeamMember.findOne({ where: { admin_id: adminId } });
  
    res.json({
      admin: !isTeamMember,
      email: req.admin.email,
    });
  });

  const getAllPartnerTeamMembers = safe(async (req, res) => {
    const partnerTeamMembers = await PartnerTeamMember.findAll({
      include: [
        { model: Partner, as: 'partner',          attributes: ['id', 'username', 'email'] },
        { model: Partner, as: 'invitedByPartner', attributes: ['id', 'username', 'email'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ partnerTeamMembers });
  });


  
  return {
    register,
    login,
    resetPassword,
    getAllPartners,
    getPartner,
    updatePartner,
    deletePartner,
    getAllRequests,
    getRequest,
    updateRequestStatus,
    uploadDocuments,  
    inviteTeamMember,
    getTeamMembers,
    checkAdminRole,
    updateRequestPrice,
    approvePartnerTeamMember,
    denyPartnerTeamMember,
    getAllPartnerTeamMembers
  };

};




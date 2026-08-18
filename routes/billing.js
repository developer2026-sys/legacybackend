'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mailgun = require('mailgun.js');
const FormData = require('form-data');
const authenticate = require('../middleware/middleware');
const { MemorialRequest, RequestPhoto } = require('../models');

const mg = new mailgun(FormData);
const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});
const domain = process.env.MAILGUN_DOMAIN;

const PACKAGE_LABELS = {
  basic_annual: { label: 'Basic Annual', price: '$549' },
  premium_annual: { label: 'Premium Annual', price: '$749' },
};

// storagePath is whatever createRequest saved it as. If it's already absolute
// it's used as-is; otherwise it's resolved relative to PHOTOS_ROOT.
// Adjust PHOTOS_ROOT if your uploadPhotos middleware saves files elsewhere.
const PHOTOS_ROOT = '/tmp/public/files';

const buildPaymentRequestHtml = ({ partnerName, partnerEmail, label, price, memorialRequest }) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
      .header { background: #ffffff; color: #1e3c72; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e0e0e0; }
      .header h1 { margin: 0 0 10px 0; font-size: 24px; font-weight: 600; }
      .header p { margin: 5px 0; font-size: 14px; opacity: 0.9; color: #666; }
      .content { padding: 30px 20px; }
      .section { margin-bottom: 25px; }
      .section-title { font-size: 16px; font-weight: 600; color: #1e3c72; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
      .info-card { background-color: #f9f9f9; border-left: 4px solid #2a5298; padding: 20px; border-radius: 4px; margin-bottom: 15px; }
      .info-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
      .info-row:last-child { margin-bottom: 0; }
      .info-label { color: #666; font-weight: 500; }
      .info-value { color: #1e3c72; font-weight: 700; text-align: right; }
      .total-revenue-card { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 25px; border-radius: 4px; text-align: center; margin-bottom: 20px; }
      .total-revenue-label { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
      .total-revenue-value { font-size: 36px; font-weight: 700; }
      .footer { background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; }
      .footer p { margin: 5px 0; font-size: 12px; color: #666; }
      .footer-brand { font-weight: 700; color: #1e3c72; margin-bottom: 5px; }
      .footer-tagline { font-size: 11px; color: #999; margin-bottom: 10px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <img src="https://res.cloudinary.com/dbjwbveqn/image/upload/v1782322278/ea262c67-909f-4213-ac77-e17bff68b659_l7nx6o.jpg" alt="Lasting Legacy Cleaners" style="height: 80px; width: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />
        <h1>Payment Request</h1>
        <p>${partnerName}</p>
        <p>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="content">
        <div class="section">
          <div class="section-title">Package Details</div>
          <div class="info-card">
            <div class="info-row"><span class="info-label">Package:</span><span class="info-value">${label}</span></div>
            <div class="info-row"><span class="info-label">Price:</span><span class="info-value">${price}</span></div>
          </div>
        </div>
        <div class="total-revenue-card">
          <div class="total-revenue-label">Package Price</div>
          <div class="total-revenue-value">${price}</div>
        </div>
        <div class="section">
          <div class="section-title">Partner Information</div>
          <div class="info-card">
            <div class="info-row"><span class="info-label">Partner Name:</span><span class="info-value">${partnerName}</span></div>
            <div class="info-row"><span class="info-label">Partner Email:</span><span class="info-value">${partnerEmail}</span></div>
          </div>
        </div>
        <div class="section">
          <div class="section-title">Request Details</div>
          <div class="info-card">
            <div class="info-row"><span class="info-label">Customer:</span><span class="info-value">${memorialRequest.customerName}</span></div>
            <div class="info-row"><span class="info-label">Memorial Location:</span><span class="info-value">${memorialRequest.memorialLocation}</span></div>
          </div>
        </div>
      </div>
      <div class="footer">
        <img src="https://lastinglegacycleaners.com/wp-content/uploads/2026/06/C0B6C462-9577-4FC4-B2A1-1D9DBB8DCE5F.png" alt="Lasting Legacy Cleaners" style="max-width: 200px; width: 100%; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />
        <div class="footer-brand">Lasting Legacy Cleaners</div>
        <div class="footer-tagline">Preserve The Legacy. Restore The Beauty.</div>
        <p>12175 Visionary Way, Fishers, IN 46038</p>
        <p>Phone: 317.970.3904</p>
        <p>Email: <a href="mailto:rsmith@lastinglegacycleaners.com" style="color: #1e3c72; text-decoration: none;">rsmith@lastinglegacycleaners.com</a></p>
        <p style="margin-top: 12px;">
          <a href="https://lastinglegacycleaners.com/terms-conditions/" target="_blank" style="color: #1e3c72; text-decoration: none; font-size: 12px;">Terms of Service</a>
          <span style="color: #999; margin: 0 8px;">|</span>
          <a href="https://lastinglegacycleaners.com/privacy-policy/" target="_blank" style="color: #1e3c72; text-decoration: none; font-size: 12px;">Privacy Policy</a>
        </p>
      </div>
    </div>
  </body>
  </html>
`;

router.post('/send-payment-request', authenticate, async (req, res) => {
  try {
    const { packageType, requestId } = req.body;

    if (!packageType || !PACKAGE_LABELS[packageType]) {
      return res.status(400).json({ message: 'Invalid or missing packageType.' });
    }
    if (!requestId) {
      return res.status(400).json({ message: 'Missing requestId.' });
    }

    // Confirm this request belongs to the logged-in partner before attaching anything
    const memorialRequest = await MemorialRequest.findOne({
      where: { id: requestId, partnerId: req.partner.id },
      include: [{ model: RequestPhoto, as: 'photos' }],
    });

    if (!memorialRequest) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const partnerName = req.partner?.contactName || req.partner?.username || 'Unknown Partner';
    const partnerEmail = req.partner?.email || 'Unknown Email';
    const { label, price } = PACKAGE_LABELS[packageType];

    const subject = `Payment Request — ${label} (${partnerName})`;
    const html = buildPaymentRequestHtml({ partnerName, partnerEmail, label, price, memorialRequest });

    // Build Mailgun attachments from photos that actually exist on disk
    const attachments = [];
    for (const photo of memorialRequest.photos || []) {
      const filePath = path.isAbsolute(photo.storagePath)
        ? photo.storagePath
        : path.join(PHOTOS_ROOT, photo.storagePath);

      if (fs.existsSync(filePath)) {
        attachments.push({
          filename: path.basename(filePath),
          data: fs.readFileSync(filePath),
        });
      } else {
        console.warn(`Photo file missing on disk, skipping: ${filePath}`);
      }
    }

    const messageData = {
      from: `Lasting Legacy Cleaners <no-reply@${domain}>`,
      to: ['lemightyeagle@gmail.com'],
      subject,
      html,
    };

    if (attachments.length > 0) {
      messageData.attachment = attachments;
    }

    await client.messages.create(domain, messageData);

    return res.status(200).json({ message: 'Payment request email sent.' });
  } catch (err) {
    console.error('Mailgun send failed:', err);
    return res.status(500).json({ message: 'Failed to send payment request email.' });
  }
});

module.exports = router;
'use strict';

const mailgun = require('mailgun.js');
const FormData = require('form-data');

const mg = new mailgun(FormData);
const domain = process.env.MAILGUN_DOMAIN;
const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

const sendDailyReminderEmail = async (partnerEmail, partnerName, stats) => {
  const {
    soldCount, annualGoal, remainingCount, progressPercent,
    basicCount, basicRevenue, premiumCount, premiumRevenue,
    totalRevenue, activeRequests, completedRequests, pendingRequests,
  } = stats;

  const htmlContent = `
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
        .progress-card { background-color: #f9f9f9; border-left: 4px solid #2a5298; padding: 20px; border-radius: 4px; margin-bottom: 15px; }
        .progress-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        .progress-label { color: #666; font-weight: 500; }
        .progress-value { color: #1e3c72; font-weight: 700; }
        .progress-bar-container { background-color: #e0e0e0; height: 24px; border-radius: 12px; overflow: hidden; margin-top: 15px; }
        .progress-bar { height: 100%; background: linear-gradient(90deg, #22c55e 0%, #16a34a 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 600; }
        .revenue-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .revenue-card { background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; }
        .revenue-card-title { font-size: 13px; font-weight: 600; color: #666; margin-bottom: 10px; }
        .revenue-item { margin-bottom: 8px; font-size: 13px; }
        .revenue-item-label { color: #666; }
        .revenue-item-value { color: #1e3c72; font-weight: 700; float: right; }
        .revenue-item::after { content: ''; display: table; clear: both; }
        .total-revenue-card { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 25px; border-radius: 4px; text-align: center; margin-bottom: 20px; }
        .total-revenue-label { font-size: 14px; opacity: 0.9; margin-bottom: 8px; }
        .total-revenue-value { font-size: 36px; font-weight: 700; }
        .activity-card { background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; margin-bottom: 10px; }
        .activity-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; }
        .activity-row:last-child { margin-bottom: 0; }
        .activity-label { color: #666; }
        .activity-value { color: #1e3c72; font-weight: 700; }
        .cta-button { display: block; width: 100%; padding: 15px; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; text-decoration: none; text-align: center; border-radius: 4px; font-weight: 600; margin: 25px 0; font-size: 14px; }
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
  <h1>Daily Partnership Update</h1>
  <p>${partnerName}</p>
  <p>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</div>
        <div class="content">
          <div class="section">
            <div class="section-title">Annual Goal Progress</div>
            <div class="progress-card">
              <div class="progress-row"><span class="progress-label">Annual Goal:</span><span class="progress-value">${annualGoal} Memorials</span></div>
              <div class="progress-row"><span class="progress-label">Memorials Sold:</span><span class="progress-value">${soldCount}</span></div>
              <div class="progress-row"><span class="progress-label">Remaining:</span><span class="progress-value">${remainingCount}</span></div>
              <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${progressPercent}%">
                  ${progressPercent > 10 ? progressPercent.toFixed(1) + '%' : ''}
                </div>
              </div>
            </div>
          </div>
          <div class="section">
            <div class="section-title">Revenue Breakdown</div>
            <div class="revenue-section">
              <div class="revenue-card">
                <div class="revenue-card-title">Basic Restoration</div>
                <div class="revenue-item"><span class="revenue-item-label">Package Price:</span><span class="revenue-item-value">$549</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Partner Revenue:</span><span class="revenue-item-value">$100</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Sold:</span><span class="revenue-item-value">${basicCount}</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Revenue:</span><span class="revenue-item-value">$${basicRevenue.toFixed(2)}</span></div>
              </div>
              <div class="revenue-card">
                <div class="revenue-card-title">Premium Restoration</div>
                <div class="revenue-item"><span class="revenue-item-label">Package Price:</span><span class="revenue-item-value">$749</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Partner Revenue:</span><span class="revenue-item-value">$150</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Sold:</span><span class="revenue-item-value">${premiumCount}</span></div>
                <div class="revenue-item"><span class="revenue-item-label">Revenue:</span><span class="revenue-item-value">$${premiumRevenue.toFixed(2)}</span></div>
              </div>
            </div>
          </div>
          <div class="total-revenue-card">
            <div class="total-revenue-label">Current Partner Revenue</div>
            <div class="total-revenue-value">$${totalRevenue.toFixed(2)}</div>
          </div>
          <div class="section">
            <div class="section-title">Recent Activity</div>
            <div class="activity-card">
              <div class="activity-row"><span class="activity-label">Active Memorial Requests:</span><span class="activity-value">${activeRequests}</span></div>
              <div class="activity-row"><span class="activity-label">Completed Restorations:</span><span class="activity-value">${completedRequests}</span></div>
              <div class="activity-row"><span class="activity-label">Pending Approvals:</span><span class="activity-value">${pendingRequests}</span></div>
            </div>
          </div>
         
        </div>
       <div class="footer">
  <img src="https://lastinglegacycleaners.com/wp-content/uploads/2026/06/C0B6C462-9577-4FC4-B2A1-1D9DBB8DCE5F.png" alt="Lasting Legacy Cleaners" style="max-width: 200px; width: 100%; height: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />
  <a href="https://lastinglegacycleaners.com/app/" target="_blank" style="display: inline-block; padding: 12px 30px; background-color: #1e3c72; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">Login to Dashboard →</a>
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

  try {
    const response = await client.messages.create(domain, {
      from: `Lasting Legacy Cleaners <noreply@${domain}>`,
      to: partnerEmail,
      subject: `Daily Partnership Update - ${partnerName}`,
      html: htmlContent,
    });
    console.log(`Email sent to ${partnerEmail}:`, response.id);
    return response;
  } catch (error) {
    console.error(`Failed to send email to ${partnerEmail}:`, error);
    throw error;
  }
};

module.exports = {
  sendDailyReminderEmail,
};
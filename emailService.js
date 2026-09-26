'use strict';

const mailgun = require('mailgun.js');
const FormData = require('form-data');

const domain = process.env.MAILGUN_DOMAIN;
const getClient = () => new mailgun(FormData).client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});

const sendDailyReminderEmail = async (partnerEmail, partnerName, stats) => {
  const {
    soldCount, annualGoal, remainingCount, progressPercent,
    packageBreakdown = [],
    totalRevenue, activeRequests, completedRequests, pendingRequests,
  } = stats;
  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const packageCards = packageBreakdown.length
    ? packageBreakdown.map((item) => `
      <div class="revenue-card">
        <div class="revenue-card-title">${String(item.name).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</div>
        <div class="revenue-item"><span class="revenue-item-label">Requests:</span><span class="revenue-item-value">${item.count}</span></div>
        <div class="revenue-item"><span class="revenue-item-label">Restoration total:</span><span class="revenue-item-value">${money(item.restorationTotal)}</span></div>
        <div class="revenue-item"><span class="revenue-item-label">Revenue share:</span><span class="revenue-item-value">${money(item.revenueShareTotal)}</span></div>
      </div>
    `).join('')
    : '<div class="revenue-card">No completed or approved package requests yet.</div>';

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
        .revenue-section { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px; }
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
              ${packageCards}
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
    const response = await getClient().messages.create(domain, {
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

const sendRequestSubmittedEmail = async ({
  recipientEmail,
  recipientName,
  requestNumber,
  submittedAt,
  advisorName,
  customerName,
  memorialLocation,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const date = submittedAt
    ? new Date(submittedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  const subject = `Request submitted: ${requestNumber}`;
  const text = [
    `Hello ${recipientName || 'Client Admin'},`,
    '',
    `${advisorName || 'A Family Advisor'} submitted a memorial request for review.`,
    `Request ID: ${requestNumber}`,
    `Customer: ${customerName || '—'}`,
    `Property: ${memorialLocation || '—'}`,
    `Submitted: ${date}`,
  ].join('\n');
  const html = `
    <p>Hello ${escapeHtml(recipientName || 'Client Admin')},</p>
    <p>${escapeHtml(advisorName || 'A Family Advisor')} submitted a memorial request for review.</p>
    <ul>
      <li><strong>Request ID:</strong> ${escapeHtml(requestNumber)}</li>
      <li><strong>Customer:</strong> ${escapeHtml(customerName || '—')}</li>
      <li><strong>Property:</strong> ${escapeHtml(memorialLocation || '—')}</li>
      <li><strong>Submitted:</strong> ${escapeHtml(date)}</li>
    </ul>
  `;

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipientEmail,
    subject,
    text,
    html,
  });
};

const sendRequestStatusUpdateEmail = async ({
  recipientEmail,
  recipientName,
  requestNumber,
  customerName,
  propertyName,
  status,
  reason,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const statusLabel = String(status || '').toLowerCase().replace(/_/g, ' ');
  const subject = `Request update: ${statusLabel} - ${requestNumber}`;
  const details = [
    `Request ID: ${requestNumber}`,
    `Customer: ${customerName || '—'}`,
    `Property: ${propertyName || '—'}`,
    `Status: ${statusLabel}`,
    reason ? `Note: ${reason}` : null,
  ].filter(Boolean).join('\n');
  const html = `
    <p>Hello ${escapeHtml(recipientName || 'Advisor')},</p>
    <p>There is an update to the request you submitted.</p>
    <ul>
      <li><strong>Request ID:</strong> ${escapeHtml(requestNumber)}</li>
      <li><strong>Customer:</strong> ${escapeHtml(customerName || '—')}</li>
      <li><strong>Property:</strong> ${escapeHtml(propertyName || '—')}</li>
      <li><strong>Status:</strong> ${escapeHtml(statusLabel)}</li>
      ${reason ? `<li><strong>Note:</strong> ${escapeHtml(reason)}</li>` : ''}
    </ul>
  `;

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipientEmail,
    subject,
    text: `Hello ${recipientName || 'Advisor'},\n\n${details}`,
    html,
  });
};

const sendMonumentCompletionEmail = async ({
  recipientEmail,
  recipientName,
  requestNumber,
  familyName,
  cemeteryName,
  completedAt,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const completedDate = completedAt
    ? new Date(completedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
  const details = [
    `Request: ${requestNumber}`,
    `Family: ${familyName || '—'}`,
    `Cemetery: ${cemeteryName || '—'}`,
    `Completed: ${completedDate}`,
  ].join('\n');

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipientEmail,
    subject: `Monument setting complete: ${requestNumber}`,
    text: `The monument setting job is complete. Before and after photos are available in the dashboard: https://lastinglegacycleaners.com/app/\n\nHello ${recipientName || 'there'},\n\n${details}`,
    html: `
      <p>Hello ${escapeHtml(recipientName || 'there')},</p>
      <p>The monument setting job is complete. Before and after photos are available in the <a href="https://lastinglegacycleaners.com/app/">dashboard</a>.</p>
      <ul>
        <li><strong>Request:</strong> ${escapeHtml(requestNumber)}</li>
        <li><strong>Family:</strong> ${escapeHtml(familyName || '—')}</li>
        <li><strong>Cemetery:</strong> ${escapeHtml(cemeteryName || '—')}</li>
        <li><strong>Completed:</strong> ${escapeHtml(completedDate)}</li>
      </ul>
    `,
  });
};

const sendMonumentSettingStatusUpdateEmail = async ({
  recipientEmail,
  recipientName,
  requestNumber,
  familyName,
  cemeteryName,
  status,
  scheduledDate,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const statusLabel = String(status || '').replace(/_/g, ' ');
  const details = [
    `Request: ${requestNumber}`,
    `Family: ${familyName || '—'}`,
    `Cemetery: ${cemeteryName || '—'}`,
    `Status: ${statusLabel}`,
    scheduledDate ? `Scheduled date: ${scheduledDate}` : null,
  ].filter(Boolean).join('\n');

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipientEmail,
    subject: `Monument setting update: ${statusLabel} - ${requestNumber}`,
    text: `There is an update to a monument setting request.\n\nHello ${recipientName || 'there'},\n\n${details}`,
    html: `
      <p>Hello ${escapeHtml(recipientName || 'there')},</p>
      <p>There is an update to a monument setting request.</p>
      <ul>
        <li><strong>Request:</strong> ${escapeHtml(requestNumber)}</li>
        <li><strong>Family:</strong> ${escapeHtml(familyName || '—')}</li>
        <li><strong>Cemetery:</strong> ${escapeHtml(cemeteryName || '—')}</li>
        <li><strong>Status:</strong> ${escapeHtml(statusLabel)}</li>
        ${scheduledDate ? `<li><strong>Scheduled date:</strong> ${escapeHtml(scheduledDate)}</li>` : ''}
      </ul>
    `,
  });
};

const sendTeamMemberStatusUpdateEmail = async ({
  recipientEmail,
  recipientName,
  memberEmail,
  requestType,
  status,
  reason,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const actionLabel = {
    add: 'activation',
    deactivate: 'deactivation',
    remove: 'removal',
  }[requestType] || 'update';
  const statusLabel = String(status || '').toLowerCase();
  const subject = `Team member ${actionLabel} ${statusLabel}: ${memberEmail}`;
  const details = [
    `Team member: ${memberEmail}`,
    `Request type: ${actionLabel}`,
    `Status: ${statusLabel}`,
    reason ? `Note: ${reason}` : null,
  ].filter(Boolean).join('\n');
  const html = `
    <p>Hello ${escapeHtml(recipientName || 'Client Admin')},</p>
    <p>A team member ${escapeHtml(actionLabel)} request has been ${escapeHtml(statusLabel)}.</p>
    <ul>
      <li><strong>Team member:</strong> ${escapeHtml(memberEmail)}</li>
      <li><strong>Request type:</strong> ${escapeHtml(actionLabel)}</li>
      <li><strong>Status:</strong> ${escapeHtml(statusLabel)}</li>
      ${reason ? `<li><strong>Note:</strong> ${escapeHtml(reason)}</li>` : ''}
    </ul>
  `;

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipientEmail,
    subject,
    text: `Hello ${recipientName || 'Client Admin'},\n\n${details}`,
    html,
  });
};



const sendApInvoiceEmail = async ({
  recipientEmail,
  invoiceId,
  requestNumber,
  customerName,
  propertyName,
  amount,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
  const invoiceNumber = `INV-${invoiceId}`;
  const invoiceAmount = `$${Number(amount || 0).toFixed(2)}`;
  const details = [
    `Invoice: ${invoiceNumber}`,
    `Request: ${requestNumber}`,
    `Customer: ${customerName || '—'}`,
    `Property: ${propertyName || '—'}`,
    `Amount due: ${invoiceAmount}`,
  ].join('\n');

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: "lemightyeagle@gmail.com",
    subject: `Invoice ${invoiceNumber} — ${requestNumber}`,
    text: `A memorial restoration invoice is ready for accounts payable.\n\n${details}`,
    html: `
      <p>A memorial restoration invoice is ready for accounts payable.</p>
      <ul>
        <li><strong>Invoice:</strong> ${escapeHtml(invoiceNumber)}</li>
        <li><strong>Request:</strong> ${escapeHtml(requestNumber)}</li>
        <li><strong>Customer:</strong> ${escapeHtml(customerName || '—')}</li>
        <li><strong>Property:</strong> ${escapeHtml(propertyName || '—')}</li>
        <li><strong>Amount due:</strong> ${escapeHtml(invoiceAmount)}</li>
      </ul>
    `,
  });
};


module.exports = {
  sendDailyReminderEmail,
  sendRequestSubmittedEmail,
  sendRequestStatusUpdateEmail,
  sendMonumentCompletionEmail,
  sendMonumentSettingStatusUpdateEmail,
  sendApInvoiceEmail,
  sendTeamMemberStatusUpdateEmail,
};
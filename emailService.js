'use strict';

const mailgun = require('mailgun.js');
const FormData = require('form-data');
const { buildInvoicePdf } = require('./utils/invoicePdf'); // adjust path
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
  <img src="https://res.cloudinary.com/dbjwbveqn/image/upload/v1791377127/cleanerlogo_xyy6im.jpg" alt="Lasting Legacy Cleaners" style="height: 80px; width: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />
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
  customerEmail,
  customerPhone,
  propertyName,
  memorialLocation,
  advisorName,
  amount,
  status,
  createdAt,
  dueDate,
  paidAt,
  paymentMethod,
  notes,
  adminNotes,
  lineItems = [],
  packageName,
  restorationTotal,
  revenueShareTotal,
  pricingEffectiveDate,
  nameOnMemorial,
  memorialSize,
  memorialType,
  cemeteryName,
  section,
  lot,
  space,
  vaseInfo,
  approvedBy,
  approvedAt,
  beforePhotoUrl,
  afterPhotoUrl,
}) => {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

  const money = (value) => `$${Number(value || 0).toFixed(2)}`;
  const formatDate = (value) => (value
    ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—');

  const invoiceNumber = `INV-${invoiceId}`;
  const invoiceAmount = money(amount);
  const statusLabel = String(status || 'pending').toLowerCase();

  const field = (label, value) =>
    `<div class="info-item"><span class="info-label">${label}</span><span class="info-value">${escapeHtml(value || '—')}</span></div>`;

  const requestDetails = [
    ['Customer', customerName],
    ['Customer Email', customerEmail],
    ['Customer Phone', customerPhone],
    ['Advisor', advisorName],
    ['Package', packageName],
    ['Pricing Effective', pricingEffectiveDate],
    ['Name on Memorial', nameOnMemorial],
    ['Memorial Type', memorialType],
    ['Memorial Size', memorialSize],
    ['Vase Info', vaseInfo],
    ['Property / Cemetery', propertyName || cemeteryName || memorialLocation],
    ['Memorial Location', memorialLocation],
    ['Section', section],
    ['Lot', lot],
    ['Space', space],
    ['Approved By', approvedBy],
    ['Approved At', approvedAt ? formatDate(approvedAt) : ''],
    ['Created', formatDate(createdAt)],
    ['Due Date', dueDate ? formatDate(dueDate) : ''],
    ['Paid At', paidAt ? formatDate(paidAt) : ''],
    ['Payment Method', paymentMethod],
  ];
  const requestDetailsGrid = requestDetails.map(([label, value]) => field(label, value)).join('');


  // const requestDetailsGrid = [
  //   field('Customer', customerName),
  //   field('Customer Email', customerEmail),
  //   field('Customer Phone', customerPhone),
  //   field('Advisor', advisorName),
  //   field('Package', packageName),
  //   field('Pricing Effective', pricingEffectiveDate),
  //   field('Name on Memorial', nameOnMemorial),
  //   field('Memorial Type', memorialType),
  //   field('Memorial Size', memorialSize),
  //   field('Vase Info', vaseInfo),
  //   field('Property / Cemetery', propertyName || cemeteryName),
  //   field('Memorial Location', memorialLocation),
  //   field('Section', section),
  //   field('Lot', lot),
  //   field('Space', space),
  //   field('Approved By', approvedBy),
  //   field('Approved At', approvedAt ? formatDate(approvedAt) : ''),
  //   field('Created', formatDate(createdAt)),
  //   field('Due Date', dueDate ? formatDate(dueDate) : ''),
  //   field('Paid At', paidAt ? formatDate(paidAt) : ''),
  //   field('Payment Method', paymentMethod),
  // ].join('');
  const lineItemRows = lineItems.length
    ? lineItems.map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;">${escapeHtml(item.description || item.name || '—')}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:center;">${escapeHtml(item.quantity ?? 1)}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;">${money(item.unitPrice)}</td>
        <td style="padding:10px;border-bottom:1px solid #e0e0e0;text-align:right;font-weight:700;color:#1e3c72;">${money(item.total ?? (item.quantity || 1) * (item.unitPrice || 0))}</td>
      </tr>
    `).join('')
    : '';

  const photosSection = (beforePhotoUrl || afterPhotoUrl) ? `
    <div class="section">
      <div class="section-title">Before &amp; After</div>
      <div style="display:flex;gap:15px;flex-wrap:wrap;">
        ${beforePhotoUrl ? `<div style="flex:1;min-width:220px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">Before</div><img src="${beforePhotoUrl}" alt="Before" style="width:100%;border-radius:4px;border:1px solid #e0e0e0;" /></div>` : ''}
        ${afterPhotoUrl ? `<div style="flex:1;min-width:220px;"><div style="font-size:12px;color:#666;margin-bottom:6px;">After</div><img src="${afterPhotoUrl}" alt="After" style="width:100%;border-radius:4px;border:1px solid #e0e0e0;" /></div>` : ''}
      </div>
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #ffffff; color: #1e3c72; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e0e0e0; }
        .header h1 { margin: 0 0 10px 0; font-size: 22px; font-weight: 600; }
        .header p { margin: 5px 0; font-size: 14px; color: #666; }
        .content { padding: 30px 20px; }
        .section { margin-bottom: 25px; }
        .section-title { font-size: 14px; font-weight: 600; color: #1e3c72; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background-color: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 4px; padding: 15px; }
        .info-item { font-size: 13px; }
        .info-label { color: #666; display: block; margin-bottom: 2px; }
        .info-value { color: #1e3c72; font-weight: 600; }
        table.line-items { width: 100%; border-collapse: collapse; font-size: 13px; }
        table.line-items th { text-align: left; padding: 8px 10px; background-color: #f0f0f0; color: #666; font-size: 12px; text-transform: uppercase; }
        .status-pill { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: capitalize; background-color: #fef3c7; color: #92400e; }
        .status-pill.paid { background-color: #dcfce7; color: #166534; }
        .total-card { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 22px; border-radius: 4px; text-align: center; margin-top: 10px; }
        .total-label { font-size: 13px; opacity: 0.9; margin-bottom: 6px; }
        .total-value { font-size: 32px; font-weight: 700; }
        .notes-card { background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 4px; font-size: 13px; color: #78350f; }
        .footer { background-color: #f5f5f5; padding: 20px; text-align: center; border-top: 1px solid #e0e0e0; }
        .footer p { margin: 5px 0; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://res.cloudinary.com/dbjwbveqn/image/upload/v1791377127/cleanerlogo_xyy6im.jpg" alt="Lasting Legacy Cleaners" style="height: 70px; width: auto; margin-bottom: 12px; display: block; margin-left: auto; margin-right: auto;" />
          <h1>Accounts Payable — Invoice ${escapeHtml(invoiceNumber)}</h1>
          <p>Request ${escapeHtml(requestNumber)} &middot; <span class="status-pill ${statusLabel === 'paid' ? 'paid' : ''}">${escapeHtml(statusLabel)}</span></p>
        </div>
        <div class="content">

          <div class="section">
                     <div class="section-title">Request Details</div>
            <div class="info-grid">${requestDetailsGrid}</div>
          </div>

          ${lineItemRows ? `
          <div class="section">
            <div class="section-title">Line Items</div>
            <table class="line-items">
              <thead>
                <tr><th>Description</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th></tr>
              </thead>
              <tbody>
                ${lineItemRows}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${(restorationTotal || revenueShareTotal) ? `
          <div class="section">
            <div class="section-title">Revenue Breakdown</div>
            <div class="info-grid">
              <div class="info-item"><span class="info-label">Restoration Total</span><span class="info-value">${money(restorationTotal)}</span></div>

            </div>
          </div>
          ` : ''}

          ${photosSection}

                   ${(notes || adminNotes) ? `
          <div class="section">
            <div class="section-title">Notes</div>
            ${notes ? `<div class="notes-card"><strong>Customer notes:</strong> ${escapeHtml(notes)}</div>` : ''}
            ${adminNotes ? `<div class="notes-card" style="margin-top:8px;"><strong>Admin notes:</strong> ${escapeHtml(adminNotes)}</div>` : ''}
          </div>
          ` : ''}

          <div class="total-card">
                       <div class="total-label">${statusLabel === 'paid' ? 'Amount Paid' : 'Amount Due'}</div>
            <div class="total-value">${invoiceAmount}</div>
          </div>

        </div>
        <div class="footer">
          <p>Lasting Legacy Cleaners &middot; Accounts Payable Notification</p>
          <p>12175 Visionary Way, Fishers, IN 46038 &middot; 317.970.3904</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = [
    `Invoice: ${invoiceNumber}`,
    `Request: ${requestNumber}`,
    `Status: ${statusLabel}`,
    `Customer: ${customerName || '—'} (${customerEmail || '—'}, ${customerPhone || '—'})`,
    `Advisor: ${advisorName || '—'}`,
    `Package: ${packageName || '—'}`,
    `Name on memorial: ${nameOnMemorial || '—'}`,
    `Memorial type/size: ${memorialType || '—'} / ${memorialSize || '—'}`,
    `Cemetery: ${propertyName || cemeteryName || '—'}`,
    `Location: ${memorialLocation || '—'} (Section ${section || '—'}, Lot ${lot || '—'}, Space ${space || '—'})`,
    `Vase info: ${vaseInfo || '—'}`,
    `Created: ${formatDate(createdAt)}`,
    paidAt ? `Paid: ${formatDate(paidAt)} via ${paymentMethod || '—'}` : null,
    lineItems.length ? `Line items: ${lineItems.map((i) => `${i.description || i.name} x${i.quantity ?? 1} = ${money(i.total ?? (i.quantity || 1) * (i.unitPrice || 0))}`).join('; ')}` : null,
    notes ? `Notes: ${notes}` : null,
    adminNotes ? `Admin notes: ${adminNotes}` : null,
    `Amount ${statusLabel === 'paid' ? 'paid' : 'due'}: ${invoiceAmount}`,
  ].filter(Boolean).join('\n');

  const ALWAYS_SEND_TO = [
    'shipmate2134@gmail.com',
    // 'lemightyeagle@gmail.com',
    'buchanan@lastinglegacycleaners.com',
  ];
  const recipients = [...new Set(
    [...ALWAYS_SEND_TO, recipientEmail]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase())
  )];

   // PDF copy of the invoice
  let attachment;
  try {
    const pdfBuffer = await buildInvoicePdf({
      invoiceNumber,
      requestNumber,
      statusLabel,
      details: requestDetails,
      lineItems: lineItems.map((item) => ({
        description: String(item.description || item.name || '—'),
        quantity: String(item.quantity ?? 1),
        unitPrice: money(item.unitPrice),
        total: money(item.total ?? (item.quantity || 1) * (item.unitPrice || 0)),
      })),
      restorationTotal: (restorationTotal || revenueShareTotal) ? money(restorationTotal) : null,
      notes,
      adminNotes,
      beforePhotoUrl,
      afterPhotoUrl,
      totalLabel: statusLabel === 'paid' ? 'Amount Paid' : 'Amount Due',
      totalValue: invoiceAmount,
    });
    attachment = [{ filename: `${invoiceNumber}.pdf`, data: pdfBuffer }];
  } catch (err) {
    console.error('Invoice PDF generation failed:', err); // email still goes out
  }

  return getClient().messages.create(domain, {
    from: `Lasting Legacy Cleaners <noreply@${domain}>`,
    to: recipients,
    subject: `Invoice ${invoiceNumber} — ${requestNumber} — ${customerName || 'Request'}`,
    text,
    html,
    ...(attachment && { attachment }),
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
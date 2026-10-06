'use strict';

const iso = (d) => (d ? new Date(d).toISOString() : null);
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const cfg = (tableId) => {

  const BASE = "appD9tnXBb7Zqi2tM"
  const TABLE = "tbl6klFl7VfD34hug"
  const TOKEN = "pat4iinh3RFF4NpBJ.cb8b5140efbb176e7768de1176c141fe4e1d7b35c28586ea1e94a1af36eb172f"
  return {
    BASE,
    TABLE,
    TOKEN,
    API: `https://api.airtable.com/v0/${BASE}/${TABLE}`,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  };
};

// Field names must match your Airtable column names exactly.
// function toAirtableFields(r) {
//   const fields = {
//     'Request Number': r.requestNumber,
//     'Status': r.status,
//     'Term': r.term,
//     'Client Account ID': r.clientAccountId,
//     'Location ID': r.locationId,
//   'Submitted By User ID': r.submittedByUserId ?? r.partnerId,
//     'Submitted At': iso(r.submittedAt),
//     'Package Type': r.packageType,
//     'Package ID': r.packageId,
//     'Package Name Snapshot': r.packageNameSnapshot,
//     'Package Price': r.packagePrice != null ? Number(r.packagePrice) : null,
//     'Restoration Price': r.restorationPrice != null ? Number(r.restorationPrice) : null,
//     'Revenue Share': r.revenueShare != null ? Number(r.revenueShare) : null,
//     'Invoice Amount': r.invoiceAmount != null ? Number(r.invoiceAmount) : null,
//     'Draft Pricing ID': r.draftPricingId,
//     'Pricing Effective Date': dateOnly(r.pricingEffectiveDate),
//     'Customer Name': r.customerName,
//     'Customer Phone': r.customerPhone,
//     'Customer Email': r.customerEmail,
//     'Name On Memorial': r.nameOnMemorial,
//     'Memorial Size': r.memorialSize,
//     'Memorial Type': r.memorialType,
//     'Memorial Location': r.memorialLocation,
//     'Cemetery Name': r.cemeteryName,
//     'Section': r.section,
//     'Lot': r.lot,
//     'Space': r.space,
//     'Vase Info': r.vaseInfo,
//     'Notes': r.notes,
//     'Admin Notes': r.adminNotes,
//     'Approved By': r.approvedBy,
//     'Approved At': iso(r.approvedAt),
//     'Denied By': r.deniedBy,
//     'Denied At': iso(r.deniedAt),
//   };

//   return Object.fromEntries(
//     Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
//   );
// }

function toAirtableFields(r) {
  const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');

  const photoUrls = (Array.isArray(r.photos) ? r.photos : [])
    .map((p) => {
      const raw = typeof p === 'string' ? p : p?.url || p?.publicUrl || p?.storagePath || p?.path;
      if (!raw) return null;
      if (/^https?:\/\//.test(raw)) return raw;
      return APP_URL ? `${APP_URL}/${String(raw).replace(/^\/+/, '')}` : null;
    })
    .filter(Boolean);

  const fields = {
    'Request Number': r.requestNumber,
    'Status': r.status,
    'Term': r.term,
    'Client Account ID': r.clientAccountId,
    'Location ID': r.locationId,
    'Submitted By User ID': r.submittedByUserId ?? r.partnerId,
    'Submitted At': iso(r.submittedAt),
    'Package Type': r.packageType,
    'Package ID': r.packageId,
    'Package Name Snapshot': r.packageNameSnapshot,
    'Package Price': r.packagePrice != null ? Number(r.packagePrice) : null,
    'Restoration Price': r.restorationPrice != null ? Number(r.restorationPrice) : null,
    'Revenue Share': r.revenueShare != null ? Number(r.revenueShare) : null,
    'Invoice Amount': r.invoiceAmount != null ? Number(r.invoiceAmount) : null,
    'Draft Pricing ID': r.draftPricingId,
    'Pricing Effective Date': dateOnly(r.pricingEffectiveDate),
    'Customer Name': r.customerName,
    'Customer Phone': r.customerPhone,
    'Customer Email': r.customerEmail,
    'Name On Memorial': r.nameOnMemorial,
    'Memorial Size': r.memorialSize,
    'Memorial Type': r.memorialType,
    'Memorial Location': r.memorialLocation,
    'Cemetery Name': r.cemeteryName,
    'Section': r.section,
    'Lot': r.lot,
    'Space': r.space,
    'Vase Info': r.vaseInfo,
    'Notes': r.notes,
    'Admin Notes': r.adminNotes,
    'Approved By': r.approvedBy,
    'Approved At': iso(r.approvedAt),
    'Denied By': r.deniedBy,
    'Denied At': iso(r.deniedAt),

    // Attachment field in Airtable
    'Photos': photoUrls.length ? JSON.stringify(photoUrls) : null,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );
}

async function findRecordId(value, fieldName = 'Request Number', tableId) {
  const { API, headers } = cfg(tableId);
  const formula = encodeURIComponent(`{${fieldName}}='${String(value).replace(/'/g, "\\'")}'`);
  const res = await fetch(`${API}?filterByFormula=${formula}&maxRecords=1`, { headers });
  if (!res.ok) throw new Error(`Airtable lookup failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.records?.[0]?.id || null;
}

async function syncMemorialRequest(request) {
  const { BASE, TABLE, TOKEN, API, headers } = cfg();
  if (!TOKEN || !BASE || !TABLE) {
    console.warn('[airtable] env vars missing, skipping sync');
    return;
  }
  console.log(`[airtable] base=${BASE} table=${TABLE} tokenLen=${TOKEN.length}`);

  const plain = typeof request.toJSON === 'function' ? request.toJSON() : request;
  const fields = toAirtableFields(plain);
  console.log('[airtable] model keys:', Object.keys(plain).join(', '));
 console.log('[airtable] payload:', JSON.stringify(fields));
  const existingId = await findRecordId(plain.requestNumber);

  const res = await fetch(existingId ? `${API}/${existingId}` : API, {
    method: existingId ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable sync failed: ${res.status} ${await res.text()}`);
  console.log('[airtable] synced', plain.requestNumber);
  return res.json();
}

async function syncRegisteredUser(partner, extra = {}) {
  const BASE = "appD9tnXBb7Zqi2tM"
  const TABLE = "tblZ7MUpu4VTrFYCY"
  const TOKEN = "pat4iinh3RFF4NpBJ.cb8b5140efbb176e7768de1176c141fe4e1d7b35c28586ea1e94a1af36eb172f"

  if (!BASE || !TABLE || !TOKEN) {
    console.warn('[airtable] users env vars missing, skipping user sync');
    return;
  }
  const url = `https://api.airtable.com/v0/${BASE}/${TABLE}`;
  console.log('[airtable] user sync ->', url);

  const p = typeof partner.toJSON === 'function' ? partner.toJSON() : partner;
  const fields = Object.fromEntries(
    Object.entries({
      'Email': p.email,
      'Partner ID': p.id,
      'Full Name': p.contactName,
      'Organization': extra.organization,
      'Phone': p.phone,
      'Status': p.status,
      'Account Role': p.accountRole,
      'Client Account ID': p.clientAccountId,
      'Registered At': iso(p.createdAt),
    }).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable user sync failed: ${res.status} ${await res.text()}`);
  console.log('[airtable] user synced', p.email);
  return res.json();
}
async function syncTeamMember(teamMember, newAdmin) {
  const BASE = "appD9tnXBb7Zqi2tM"
  const TABLE = "tblmU2mLnMSiwaeJo"
  const TOKEN = "pat4iinh3RFF4NpBJ.cb8b5140efbb176e7768de1176c141fe4e1d7b35c28586ea1e94a1af36eb172f"


  if (!BASE || !TABLE || !TOKEN) {
    console.warn('[airtable] team env vars missing, skipping team sync');
    return;
  }
  const url = `https://api.airtable.com/v0/${BASE}/${TABLE}`;

  const tm = typeof teamMember.toJSON === 'function' ? teamMember.toJSON() : teamMember;
  const fields = Object.fromEntries(
    Object.entries({
      'Email': newAdmin.email,
      'Team Member ID': tm.id,
      'Admin ID': tm.admin_id ?? tm.partner_id,
      'Invited By Admin ID': tm.invited_by_admin_id ?? tm.invited_by_partner_id,
      'Status': tm.status,
      'Request Type': tm.request_type,
      'Invited At': iso(tm.createdAt || tm.created_at || new Date()),
    }).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable team sync failed: ${res.status} ${await res.text()}`);
  console.log('[airtable] team member synced', newAdmin.email);
  return res.json();
}

async function syncTeamMemberStatus(member, partner) {
  const BASE = "appD9tnXBb7Zqi2tM"
  const TABLE = "tblmU2mLnMSiwaeJo"
  const TOKEN = "pat4iinh3RFF4NpBJ.cb8b5140efbb176e7768de1176c141fe4e1d7b35c28586ea1e94a1af36eb172f"

  
  if (!BASE || !TABLE || !TOKEN) {
    console.warn('[airtable] team env vars missing, skipping team status sync');
    return;
  }
  const url = `https://api.airtable.com/v0/${BASE}/${TABLE}`;
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

  const m = typeof member.toJSON === 'function' ? member.toJSON() : member;
  const fields = Object.fromEntries(
    Object.entries({
      'Email': partner.email,
      'Team Member ID': m.id,
      'Admin ID': m.partner_id,
      'Invited By Admin ID': m.invited_by_partner_id,
      'Status': m.status,
      'Request Type': m.request_type,
      'Approved By Admin ID': m.approved_by_admin_id,
      'Approved At': iso(m.approved_at),
    }).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );

  const formula = encodeURIComponent(`{Team Member ID}=${Number(m.id)}`);
  const lookup = await fetch(`${url}?filterByFormula=${formula}&maxRecords=1`, { headers });
  if (!lookup.ok) throw new Error(`Airtable team lookup failed: ${lookup.status} ${await lookup.text()}`);
  const existingId = (await lookup.json()).records?.[0]?.id || null;

  if (!existingId) fields['Invited At'] = iso(m.createdAt || m.created_at || new Date());

  const res = await fetch(existingId ? `${url}/${existingId}` : url, {
    method: existingId ? 'PATCH' : 'POST',
    headers,
    body: JSON.stringify({ fields, typecast: true }),
  });
  if (!res.ok) throw new Error(`Airtable team status sync failed: ${res.status} ${await res.text()}`);
  console.log('[airtable] team member status synced', partner.email, m.status);
  return res.json();
}

module.exports = { syncMemorialRequest, syncRegisteredUser, syncTeamMember, syncTeamMemberStatus };
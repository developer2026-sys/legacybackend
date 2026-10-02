'use strict';

const iso = (d) => (d ? new Date(d).toISOString() : null);
const dateOnly = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

const cfg = () => {
  const BASE = (process.env.AIRTABLE_BASE_ID || '').trim();
  const TABLE = (process.env.AIRTABLE_MEMORIAL_TABLE_ID || '').trim();
  const TOKEN = (process.env.AIRTABLE_TOKEN || '').trim();
  return {
    BASE,
    TABLE,
    TOKEN,
    API: `https://api.airtable.com/v0/${BASE}/${TABLE}`,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  };
};

// Field names must match your Airtable column names exactly.
function toAirtableFields(r) {
  const fields = {
    'Request Number': r.requestNumber,
    'Status': r.status,
    'Term': r.term,
    'Client Account ID': r.clientAccountId,
    'Location ID': r.locationId,
    'Submitted By User ID': r.submittedByUserId,
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
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== '')
  );
}

async function findRecordId(requestNumber) {
  const { API, headers } = cfg();
  const formula = encodeURIComponent(`{Request Number}='${String(requestNumber).replace(/'/g, "\\'")}'`);
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
  console.log(`[airtable] base=${BASE} table=${TABLE} token=${TOKEN.slice(0, 6)}...${TOKEN.slice(-4)} (len ${TOKEN.length})`);

  const plain = typeof request.toJSON === 'function' ? request.toJSON() : request;
  const fields = toAirtableFields(plain);
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

module.exports = { syncMemorialRequest };
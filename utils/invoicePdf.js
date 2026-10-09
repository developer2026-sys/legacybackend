const PDFDocument = require('pdfkit/js/pdfkit.standalone');

const C = { navy: '#1e3c72', gray: '#666666', border: '#e0e0e0', light: '#f9f9f9', head: '#f0f0f0' };
const LOGO_URL = 'https://res.cloudinary.com/dbjwbveqn/image/upload/v1791377127/cleanerlogo_xyy6im.jpg';

const loadImage = async (url) => {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
};

const buildInvoicePdf = async ({
  invoiceNumber, requestNumber, statusLabel, details, lineItems = [],
  restorationTotal, notes, adminNotes, beforePhotoUrl, afterPhotoUrl,
  totalLabel, totalValue,
}) => {
  const [logoBuf, beforeBuf, afterBuf] = await Promise.all([
    loadImage(LOGO_URL), loadImage(beforePhotoUrl), loadImage(afterPhotoUrl),
  ]);

  const doc = new PDFDocument({ size: 'LETTER', margin: 40 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const L = doc.page.margins.left;
  const W = doc.page.width - L - doc.page.margins.right;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  let y = doc.page.margins.top;

  const ensure = (h) => {
    if (y + h > pageBottom) { doc.addPage(); y = doc.page.margins.top; }
  };
  const sectionTitle = (t) => {
    ensure(30);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
      .text(t.toUpperCase(), L, y, { characterSpacing: 0.5 });
    y = doc.y + 8;
  };

  // ---------- Header ----------
  if (logoBuf) {
    try {
      doc.image(logoBuf, L + (W - 200) / 2, y, { fit: [200, 60], align: 'center' });
      y += 72;
    } catch { /* unsupported image, skip logo */ }
  }
  doc.font('Helvetica-Bold').fontSize(18).fillColor(C.navy)
    .text(`Accounts Payable — Invoice ${invoiceNumber}`, L, y, { width: W, align: 'center' });
  y = doc.y + 6;
  doc.font('Helvetica').fontSize(10).fillColor(C.gray)
    .text(`Request ${requestNumber || '—'}`, L, y, { width: W, align: 'center' });
  y = doc.y + 8;

  const paid = statusLabel === 'paid';
  const pillW = 80;
  doc.roundedRect(L + (W - pillW) / 2, y, pillW, 18, 9).fill(paid ? '#dcfce7' : '#fef3c7');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(paid ? '#166534' : '#92400e')
    .text(statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1),
      L + (W - pillW) / 2, y + 5, { width: pillW, align: 'center' });
  y += 18 + 16;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).strokeColor(C.border).stroke();
  y += 22;

  // ---------- Request details grid ----------
  const pad = 15, gap = 12;
  const colW = (W - pad * 2 - gap) / 2;
  const cellH = (v) =>
    11 + doc.font('Helvetica-Bold').fontSize(10).heightOfString(v, { width: colW }) + 8;
  const rows = [];
  for (let i = 0; i < details.length; i += 2) rows.push(details.slice(i, i + 2));
  const vals = (r) => r.map(([, v]) => String(v || '—'));
  const heights = rows.map((r) => Math.max(...vals(r).map(cellH)));
  const gridH = heights.reduce((a, b) => a + b, 0) + pad * 2 - 8;

  ensure(gridH + 30);
  sectionTitle('Request Details');
  doc.roundedRect(L, y, W, gridH, 4).fillAndStroke(C.light, C.border);
  let ry = y + pad;
  rows.forEach((r, i) => {
    r.forEach(([label], j) => {
      const x = L + pad + j * (colW + gap);
      doc.font('Helvetica').fontSize(8.5).fillColor(C.gray).text(label, x, ry, { width: colW });
      doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy)
        .text(vals(r)[j], x, ry + 11, { width: colW });
    });
    ry += heights[i];
  });
  y += gridH + 24;

  // ---------- Line items ----------
  if (lineItems.length) {
    sectionTitle('Line Items');
    const cw = [W - 220, 60, 80, 80];
    const xs = [L, L + cw[0], L + cw[0] + cw[1], L + cw[0] + cw[1] + cw[2]];
    const aligns = ['left', 'center', 'right', 'right'];

    ensure(24);
    doc.rect(L, y, W, 22).fill(C.head);
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.gray);
    ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'TOTAL'].forEach((h, i) =>
      doc.text(h, xs[i] + 8, y + 7, { width: cw[i] - 16, align: aligns[i] }));
    y += 22;

    lineItems.forEach((item) => {
      doc.font('Helvetica').fontSize(10);
      const h = doc.heightOfString(item.description, { width: cw[0] - 16 }) + 18;
      ensure(h);
      doc.font('Helvetica').fontSize(10).fillColor('#333333')
        .text(item.description, xs[0] + 8, y + 9, { width: cw[0] - 16 });
      doc.text(item.quantity, xs[1] + 8, y + 9, { width: cw[1] - 16, align: 'center' });
      doc.text(item.unitPrice, xs[2] + 8, y + 9, { width: cw[2] - 16, align: 'right' });
      doc.font('Helvetica-Bold').fillColor(C.navy)
        .text(item.total, xs[3] + 8, y + 9, { width: cw[3] - 16, align: 'right' });
      doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(1).strokeColor(C.border).stroke();
      y += h;
    });
    y += 24;
  }

  // ---------- Revenue breakdown ----------
  if (restorationTotal) {
    ensure(80);
    sectionTitle('Revenue Breakdown');
    doc.roundedRect(L, y, W, 46, 4).fillAndStroke(C.light, C.border);
    doc.font('Helvetica').fontSize(8.5).fillColor(C.gray).text('Restoration Total', L + pad, y + 10);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.navy).text(restorationTotal, L + pad, y + 22);
    y += 46 + 24;
  }

  // ---------- Before & after photos ----------
  const photos = [['Before', beforeBuf], ['After', afterBuf]]
    .map(([label, buf]) => {
      if (!buf) return null;
      try { return { label, img: doc.openImage(buf) }; } catch { return null; } // e.g. webp unsupported
    })
    .filter(Boolean);

  if (photos.length) {
    const pw = (W - 15) / 2;
    const rowH = Math.max(...photos.map((p) => Math.min(220, (p.img.height / p.img.width) * pw)));
    ensure(rowH + 60);
    sectionTitle('Before & After');
    photos.forEach((p, i) => {
      const x = L + i * (pw + 15);
      doc.font('Helvetica').fontSize(9).fillColor(C.gray).text(p.label, x, y);
      doc.image(p.img, x, y + 14, { fit: [pw, 220] });
    });
    y += 14 + rowH + 24;
  }

  // ---------- Notes ----------
  const noteCard = (label, text) => {
    doc.font('Helvetica').fontSize(10);
    const h = doc.heightOfString(`${label} ${text}`, { width: W - 31 }) + 20;
    ensure(h + 8);
    doc.rect(L, y, W, h).fill('#fffbeb');
    doc.rect(L, y, 4, h).fill('#f59e0b');
    doc.fillColor('#78350f').font('Helvetica-Bold')
      .text(`${label} `, L + 16, y + 10, { width: W - 31, continued: true })
      .font('Helvetica').text(text);
    y += h + 8;
  };
  if (notes || adminNotes) {
    sectionTitle('Notes');
    if (notes) noteCard('Customer notes:', notes);
    if (adminNotes) noteCard('Admin notes:', adminNotes);
    y += 16;
  }

  // ---------- Total card ----------
  ensure(110);
  const grad = doc.linearGradient(L, y, L + W, y + 80);
  grad.stop(0, '#22c55e').stop(1, '#16a34a');
  doc.roundedRect(L, y, W, 80, 4).fill(grad);
  doc.fillColor('#ffffff').font('Helvetica').fontSize(10)
    .text(totalLabel, L, y + 16, { width: W, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(28)
    .text(totalValue, L, y + 34, { width: W, align: 'center' });
  y += 80 + 24;

  // ---------- Footer ----------
  ensure(50);
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1).strokeColor(C.border).stroke();
  y += 12;
  doc.font('Helvetica').fontSize(8.5).fillColor(C.gray)
    .text('Lasting Legacy Cleaners · Accounts Payable Notification', L, y, { width: W, align: 'center' });
  doc.text('12175 Visionary Way, Fishers, IN 46038 · 317.970.3904', L, doc.y + 3, { width: W, align: 'center' });

  doc.end();
  return finished;
};

module.exports = { buildInvoicePdf };
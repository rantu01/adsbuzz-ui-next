import PDFDocument from "pdfkit";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BRAND = "#E05305";
const DARK = "#1e293b";
const MUTED = "#64748b";
const LIGHT = "#e5e7eb";

function formatMonthLabel(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ""));
  if (!m) return String(month || "");
  const idx = Number(m[2]) - 1;
  const name = MONTH_NAMES[idx] || m[2];
  return `${name} ${m[1]}`;
}

function fmtUSD(v) {
  return `USD ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtBDT(v) {
  return `BDT ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCount(v) {
  return Number(v || 0).toLocaleString("en-US");
}

// ---- Shared PDF primitives -------------------------------------------------

function makeCtx(doc) {
  return {
    pageBottom: doc.page.height - doc.page.margins.bottom,
    contentWidth: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    left: doc.page.margins.left,
  };
}

function renderHeader(doc, ctx, { subtitle, generated }) {
  doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND).text("Adsbuzz LLC", { align: "left" });
  doc.font("Helvetica").fontSize(10).fillColor(MUTED)
    .text("Biswas Betka, Atpukurpar, Tangail Sadar, Tangail -1900", { align: "left" })
    .text("Hotline- 01950151501", { align: "left" });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text(subtitle, { align: "left" });
  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text(`Generated: ${generated || new Date().toLocaleString("en-US")}`, { align: "left" });
  doc.moveDown(0.6);
  doc.moveTo(ctx.left, doc.y)
    .lineTo(ctx.left + ctx.contentWidth, doc.y)
    .lineWidth(2).strokeColor(BRAND).stroke();
  doc.moveDown(1);
}

function drawTable(doc, ctx, title, columns, rows, formatCell) {
  if (doc.y > ctx.pageBottom - 110) doc.addPage();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND).text(title, { align: "left" });
  doc.moveDown(0.4);

  const colX = [];
  let cursor = ctx.left;
  for (const col of columns) {
    colX.push(cursor);
    cursor += col.width;
  }
  const totalColW = cursor - ctx.left;
  const headerH = 20;

  const drawHeader = () => {
    const hY = doc.y;
    doc.rect(ctx.left, hY, totalColW, headerH).fill(BRAND);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#ffffff");
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      doc.text(col.label, colX[i] + 4, hY + 6, {
        width: col.width - 8,
        align: col.align || "left",
      });
    }
    doc.y = hY + headerH;
  };

  drawHeader();

  doc.font("Helvetica").fontSize(9).fillColor(DARK);
  let shade = false;
  for (const row of rows) {
    const texts = columns.map((col, i) => String(formatCell(row, i, col) ?? "—"));
    let rowH = 0;
    for (let i = 0; i < columns.length; i++) {
      const h = doc.heightOfString(texts[i], {
        width: columns[i].width - 8,
        align: columns[i].align || "left",
      });
      rowH = Math.max(rowH, h);
    }
    rowH += 9;

    if (doc.y + rowH > ctx.pageBottom) {
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).fillColor(BRAND)
        .text(`${title} (continued)`, { align: "left" });
      doc.moveDown(0.4);
      drawHeader();
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
    }

    const ry = doc.y;
    if (shade) {
      doc.rect(ctx.left, ry, totalColW, rowH).fill("#f4f7fb");
    }
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      doc.fillColor(col.color || DARK);
      doc.text(texts[i], colX[i] + 4, ry + 4, {
        width: col.width - 8,
        align: col.align || "left",
      });
    }
    doc.y = ry + rowH;
    shade = !shade;
  }
  doc.moveDown(1);
}

function drawSummaryList(doc, ctx, items) {
  const labelW = 150;
  const valueW = ctx.contentWidth - labelW;
  doc.font("Helvetica").fontSize(10);
  for (const item of items) {
    const y = doc.y;
    const labelH = doc.heightOfString(item.label, { width: labelW - 8 });
    const valueH = doc.heightOfString(item.value, { width: valueW - 8 });
    const rowH = Math.max(labelH, valueH) + 2;
    doc.fillColor(MUTED).text(item.label, ctx.left, y + 1, { width: labelW - 8 });
    doc.fillColor(item.color || DARK).font("Helvetica-Bold")
      .text(item.value, ctx.left + labelW, y + 1, { width: valueW - 8 });
    doc.font("Helvetica");
    doc.y = y + rowH;
  }
}

// ---- Monthly statement PDF -------------------------------------------------

/**
 * Builds a real, multi-page A4 PDF for the monthly statement. Returns a Buffer.
 */
export function generateReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ctx = makeCtx(doc);

    renderHeader(doc, ctx, {
      subtitle: `Monthly Statement - ${formatMonthLabel(report.month)}`,
      generated: new Date().toLocaleString("en-US"),
    });

    // ---------- Summary Information (top-left) ----------
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text("Summary Information", { align: "left" });
    doc.moveDown(0.4);

    const summary = [
      { label: "Total Sell USD", value: fmtUSD(report.metrics.totalSellUSD) },
      { label: "Total Sell BDT", value: fmtBDT(report.metrics.totalSellBDT) },
      { label: "Avg Dollar Rate", value: fmtNum(report.metrics.avgPerDollarBDT) },
      { label: "Paid", value: fmtCount(report.payment.paid) },
      { label: "Due", value: fmtCount(report.payment.due) },
      { label: "Partial Paid", value: fmtCount(report.payment.partialPaid) },
      { label: "Due", value: fmtBDT(report.totals.totalDueBDT) },
      { label: "Approved", value: fmtCount(report.approval.approved) },
      { label: "Unapproved", value: fmtCount(report.approval.unapproved) },
    ];
    drawSummaryList(doc, ctx, summary);
    doc.moveDown(0.6);
    doc.moveTo(ctx.left, doc.y)
      .lineTo(ctx.left + ctx.contentWidth, doc.y)
      .lineWidth(1).strokeColor(LIGHT).stroke();
    doc.moveDown(1);

    drawTable(doc, ctx,
      "Payment Channel-Wise Report",
      [
        { label: "Payment Gateway", width: ctx.contentWidth * 0.5, align: "left" },
        { label: "Transactions", width: ctx.contentWidth * 0.25, align: "right" },
        { label: "Received Amount", width: ctx.contentWidth * 0.25, align: "right" },
      ],
      report.channelWise || [],
      (row, i) => {
        if (i === 0) return String(row.channel || "—");
        if (i === 1) return fmtCount(row.count);
        return fmtBDT(row.receivedBDT);
      }
    );

    drawTable(doc, ctx,
      "Payment Status Report",
      [
        { label: "Status", width: ctx.contentWidth * 0.25, align: "left" },
        { label: "Count", width: ctx.contentWidth * 0.19, align: "right" },
        { label: "Total Amount", width: ctx.contentWidth * 0.19, align: "right" },
        { label: "Paid", width: ctx.contentWidth * 0.185, align: "right" },
        { label: "Due", width: ctx.contentWidth * 0.185, align: "right" },
      ],
      report.paymentStatus || [],
      (row, i) => {
        if (i === 0) return String(row.status || "—");
        if (i === 1) return fmtCount(row.count);
        if (i === 2) return fmtBDT(row.totalAmountBDT);
        if (i === 3) return fmtBDT(row.paidAmountBDT);
        return fmtBDT(row.dueAmountBDT);
      }
    );

    drawTable(doc, ctx,
      "Platform-Wise Sales Report",
      [
        { label: "Platform", width: ctx.contentWidth * 0.28, align: "left" },
        { label: "Invoices", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Total (USD)", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Total (BDT)", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Due (BDT)", width: ctx.contentWidth * 0.18, align: "right" },
      ],
      report.platformWise || [],
      (row, i) => {
        if (i === 0) return String(row.platform || "—");
        if (i === 1) return fmtCount(row.count);
        if (i === 2) return fmtUSD(row.totalUSD);
        if (i === 3) return fmtBDT(row.totalBDT);
        return fmtBDT(row.dueBDT);
      }
    );

    drawTable(doc, ctx,
      "Day-Wise Sales Report",
      [
        { label: "Date", width: ctx.contentWidth * 0.28, align: "left" },
        { label: "Invoices", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Total (USD)", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Total (BDT)", width: ctx.contentWidth * 0.18, align: "right" },
        { label: "Due (BDT)", width: ctx.contentWidth * 0.18, align: "right" },
      ],
      report.dailyWise || [],
      (row, i) => {
        if (i === 0) return String(row.date || "—");
        if (i === 1) return fmtCount(row.count);
        if (i === 2) return fmtUSD(row.totalUSD);
        if (i === 3) return fmtBDT(row.totalBDT);
        return fmtBDT(row.dueBDT);
      }
    );

    drawTable(doc, ctx,
      "Audit Trail & Billing Ledger",
      [
        { label: "Invoice No", width: ctx.contentWidth * 0.18, align: "left" },
        { label: "Date", width: ctx.contentWidth * 0.14, align: "left" },
        { label: "Group", width: ctx.contentWidth * 0.14, align: "left" },
        { label: "Ad Account", width: ctx.contentWidth * 0.22, align: "left" },
        { label: "Platform", width: ctx.contentWidth * 0.12, align: "left" },
        { label: "USD", width: ctx.contentWidth * 0.1, align: "right" },
        { label: "Paid BDT", width: ctx.contentWidth * 0.1, align: "right" },
      ],
      report.ledger || [],
      (row, i) => {
        if (i === 0) return String(row.invoiceNo || "—");
        if (i === 1) return String(row.date || "—");
        if (i === 2) return String(row.groupId || "—");
        if (i === 3) return String(row.adAccountName || "—");
        if (i === 4) return String(row.platform || "—");
        if (i === 5) return fmtNum(row.topupAmountUSD);
        return fmtBDT(row.paidAmountBDT);
      }
    );

    doc.end();
  });
}

// ---- Ad Account Statement PDF ----------------------------------------------

/**
 * Builds a real, multi-page A4 PDF statement for a single Group + Ad Account,
 * covering its complete Sales Entry history regardless of assignment status.
 * Returns a Buffer.
 */
export function generateAdAccountStatementPdf(statement) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const ctx = makeCtx(doc);

    renderHeader(doc, ctx, {
      subtitle: "Ad Account Statement",
      generated: new Date().toLocaleString("en-US"),
    });

    // ---------- Statement meta ----------
    doc.font("Helvetica").fontSize(10).fillColor(DARK);
    const metaLines = [
      { label: "Group ID", value: statement.groupId || "—" },
      { label: "Ad Account", value: statement.adAccountName || "—" },
      {
        label: "Statement Period",
        value: statement.periodFrom
          ? `${statement.periodFrom}  to  ${statement.periodTo}`
          : "No sales entries",
      },
    ];
    for (const line of metaLines) {
      const y = doc.y;
      doc.fillColor(MUTED).text(`${line.label}:`, ctx.left, y, { width: 120 });
      doc.fillColor(DARK).font("Helvetica-Bold")
        .text(line.value, ctx.left + 120, y, { width: ctx.contentWidth - 120 });
      doc.font("Helvetica");
      doc.moveDown(0.5);
    }
    doc.moveDown(0.4);
    doc.moveTo(ctx.left, doc.y)
      .lineTo(ctx.left + ctx.contentWidth, doc.y)
      .lineWidth(1).strokeColor(LIGHT).stroke();
    doc.moveDown(0.8);

    // ---------- Summary ----------
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text("Summary", { align: "left" });
    doc.moveDown(0.4);

    const summary = [
      { label: "Total Entries", value: fmtCount(statement.count) },
      { label: "Total Topup (USD)", value: fmtUSD(statement.totalUSD) },
      { label: "Total Amount (BDT)", value: fmtBDT(statement.totalBDT) },
      { label: "Total Paid (BDT)", value: fmtBDT(statement.paidBDT) },
      { label: "Total Due (BDT)", value: fmtBDT(statement.dueBDT) },
      { label: "Service Fee (BDT)", value: fmtBDT(statement.serviceFeeBDT) },
    ];
    drawSummaryList(doc, ctx, summary);
    doc.moveDown(0.6);
    doc.moveTo(ctx.left, doc.y)
      .lineTo(ctx.left + ctx.contentWidth, doc.y)
      .lineWidth(1).strokeColor(LIGHT).stroke();
    doc.moveDown(1);

    // ---------- Transactions ----------
    drawTable(doc, ctx,
      "Sales Entry History",
      [
        { label: "Invoice No", width: ctx.contentWidth * 0.16, align: "left" },
        { label: "Date", width: ctx.contentWidth * 0.13, align: "left" },
        { label: "Platform", width: ctx.contentWidth * 0.13, align: "left" },
        { label: "Topup (USD)", width: ctx.contentWidth * 0.14, align: "right" },
        { label: "Total (BDT)", width: ctx.contentWidth * 0.14, align: "right" },
        { label: "Paid (BDT)", width: ctx.contentWidth * 0.14, align: "right" },
        { label: "Due (BDT)", width: ctx.contentWidth * 0.14, align: "right" },
      ],
      statement.entries || [],
      (row, i) => {
        if (i === 0) return String(row.invoiceNo || "—");
        if (i === 1) return String(row.date || "—");
        if (i === 2) return String(row.platform || "—");
        if (i === 3) return fmtNum(row.topupAmountUSD);
        if (i === 4) return fmtBDT(row.totalAmountBDT);
        if (i === 5) return fmtBDT(row.paidAmountBDT);
        return fmtBDT(row.dueAmountBDT);
      }
    );

    doc.end();
  });
}

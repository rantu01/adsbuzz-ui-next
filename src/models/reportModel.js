import { getCollection } from "@/lib/db";
import { listInvoices, getInvoicesByMonth } from "@/models/invoiceModel";
import { getSettings } from "@/models/settingsModel";
import logger from "@/utils/logger";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeMonth(value) {
  const str = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  return new Date().toISOString().slice(0, 7);
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Categorizes a vendor payment into one of the Company Expense Summary
 * buckets. This is fully data-driven: the special vendor records created in
 * the `vendors` collection ("Refund Client", "Others Payment", "Adsbuzz Own")
 * represent refunds and office expenses respectively; every other vendor is a
 * real ad-credit supplier whose payments are "Vendor Payment".
 */
function vendorExpenseCategory(vendor) {
  const name = String(vendor?.name || "").toLowerCase();
  if (name.includes("refund")) return "refund";
  if (name.includes("others payment") || name.includes("adsbuzz own") || name.includes("office")) return "office";
  return "vendor";
}

/**
 * Builds the list of actually-received BDT payments for an invoice, each with
 * its own payment channel. Invoices that had partial payments recorded through
 * the pay endpoint carry a `payments[]` sub-array; each entry keeps the channel
 * it was received through. Invoices without one attribute `paidAmountBDT` to
 * the invoice-level `paymentMethod`.
 */
function collectChannelPayments(invoice) {
  const entries = [];
  const payments = Array.isArray(invoice.payments) ? invoice.payments : [];
  if (payments.length > 0) {
    for (const p of payments) {
      const amount = toNumber(p.amountBDT);
      if (amount > 0) {
        entries.push({ channel: String(p.paymentMethod || invoice.paymentMethod || "Unknown").trim() || "Unknown", amount });
      }
    }
  } else {
    const amount = toNumber(invoice.paidAmountBDT);
    if (amount > 0) {
      entries.push({ channel: String(invoice.paymentMethod || "Unknown").trim() || "Unknown", amount });
    }
  }
  return entries;
}

/**
 * Generates the full monthly report used by the Reporting Desk. Every figure is
 * aggregated live from the actual database records (invoices, vendors) for the
 * selected month — nothing is hardcoded.
 */
export async function getMonthlyReport(month) {
  const targetMonth = normalizeMonth(month);
  // Fetch only this month's invoices with a minimal projection. Doing a
  // full-collection fetch (listInvoices) and filtering in JS was pathologically
  // slow on the shared MongoDB (minutes for a few hundred records), which made
  // /api/reports time out and the whole Reports page render 0 values.
  const monthInvoices = await getInvoicesByMonth(targetMonth);

  // ===== 1) Statement metrics (Total Sell / Average / Ads Topup / Avg per USD) =====
  const totalSellUSD = round2(monthInvoices.reduce((s, inv) => s + toNumber(inv.topupAmountUSD), 0));
  const totalSellBDT = round2(monthInvoices.reduce((s, inv) => s + toNumber(inv.totalAmountBDT || inv.paidAmountBDT), 0));

  const count = monthInvoices.length;
  const avgSellUSD = count > 0 ? round2(totalSellUSD / count) : 0;
  const avgSellBDT = count > 0 ? round2(totalSellBDT / count) : 0;

  const adTopupInvoices = monthInvoices.filter((inv) => inv.serviceType !== "Others");
  const adTopupUSD = round2(adTopupInvoices.reduce((s, inv) => s + toNumber(inv.topupAmountUSD), 0));
  const adTopupBDT = round2(adTopupInvoices.reduce((s, inv) => s + toNumber(inv.totalAmountBDT || inv.paidAmountBDT), 0));

  const avgPerDollarBDT = totalSellUSD > 0 ? round2(totalSellBDT / totalSellUSD) : 0;

  // ===== 2) Payment Approval Status =====
  const approvalApprovedCount = monthInvoices.filter((inv) => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || "Approved";
    return a === "Approved";
  }).length;
  const approvalDeclinedCount = monthInvoices.filter((inv) => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || "Approved";
    return a === "Rejected" || a === "Declined";
  }).length;
  const approvalUnapprovedCount = Math.max(0, count - approvalApprovedCount);

  // ===== 3) Payment Status Report (counts + amounts) =====
  const PAYMENT_STATUSES = ["Paid", "Due", "Partially Paid"];
  const paymentStatus = PAYMENT_STATUSES.map((status) => {
    const rows = monthInvoices.filter((inv) => inv.paymentStatus === status);
    return {
      status,
      count: rows.length,
      totalAmountBDT: round2(rows.reduce((s, inv) => s + toNumber(inv.totalAmountBDT), 0)),
      paidAmountBDT: round2(rows.reduce((s, inv) => s + toNumber(inv.paidAmountBDT), 0)),
      dueAmountBDT: round2(rows.reduce((s, inv) => s + toNumber(inv.dueAmountBDT), 0)),
    };
  });
  const paidStatus = paymentStatus.find((p) => p.status === "Paid") || { count: 0 };
  const dueStatus = paymentStatus.find((p) => p.status === "Due") || { count: 0 };
  const partialPaidStatus = paymentStatus.find((p) => p.status === "Partially Paid") || { count: 0 };

  // ===== 4) Platform-Wise Sales Report =====
  const platformMap = new Map();
  for (const inv of monthInvoices) {
    const platform = String(inv.platform || "").trim() || "Facebook";
    if (!platformMap.has(platform)) {
      platformMap.set(platform, { platform, count: 0, totalUSD: 0, totalBDT: 0, paidBDT: 0, dueBDT: 0 });
    }
    const entry = platformMap.get(platform);
    entry.count += 1;
    entry.totalUSD = round2(entry.totalUSD + toNumber(inv.topupAmountUSD));
    entry.totalBDT = round2(entry.totalBDT + toNumber(inv.totalAmountBDT || inv.paidAmountBDT));
    entry.paidBDT = round2(entry.paidBDT + toNumber(inv.paidAmountBDT));
    entry.dueBDT = round2(entry.dueBDT + toNumber(inv.dueAmountBDT));
  }
  const platformWise = Array.from(platformMap.values()).sort((a, b) => b.totalUSD - a.totalUSD);

  // ===== 5) Payment Channel-Wise Report (all configured gateways included) =====
  const channelMap = new Map();
  for (const inv of monthInvoices) {
    for (const { channel, amount } of collectChannelPayments(inv)) {
      if (!channelMap.has(channel)) channelMap.set(channel, { channel, count: 0, receivedBDT: 0 });
      const entry = channelMap.get(channel);
      entry.count += 1;
      entry.receivedBDT = round2(entry.receivedBDT + amount);
    }
  }

  // Merge with every configured payment gateway so unused ones still appear
  // with a zero received amount. This guarantees the report lists all
  // available payment gateways, not just those that received money this month.
  const settings = await getSettings();
  const configuredGateways = settings.paymentMethods || [];
  const allChannelMap = new Map();
  for (const gateway of configuredGateways) {
    const key = String(gateway || "").trim();
    if (key) allChannelMap.set(key, { channel: key, count: 0, receivedBDT: 0 });
  }
  for (const entry of channelMap.values()) {
    const key = String(entry.channel || "").trim();
    if (!allChannelMap.has(key)) allChannelMap.set(key, { channel: key, count: 0, receivedBDT: 0 });
    const target = allChannelMap.get(key);
    target.count = entry.count;
    target.receivedBDT = entry.receivedBDT;
  }
  const channelWise = Array.from(allChannelMap.values()).sort(
    (a, b) => b.receivedBDT - a.receivedBDT || String(a.channel).localeCompare(String(b.channel))
  );

  // ===== 6) Day-Wise Sales Report =====
  const dailyMap = new Map();
  for (const inv of monthInvoices) {
    const date = String(inv.date || "").slice(0, 10);
    if (!date) continue;
    if (!dailyMap.has(date)) dailyMap.set(date, { date, count: 0, totalUSD: 0, totalBDT: 0, paidBDT: 0, dueBDT: 0 });
    const entry = dailyMap.get(date);
    entry.count += 1;
    entry.totalUSD = round2(entry.totalUSD + toNumber(inv.topupAmountUSD));
    entry.totalBDT = round2(entry.totalBDT + toNumber(inv.totalAmountBDT || inv.paidAmountBDT));
    entry.paidBDT = round2(entry.paidBDT + toNumber(inv.paidAmountBDT));
    entry.dueBDT = round2(entry.dueBDT + toNumber(inv.dueAmountBDT));
  }
  const dailyWise = Array.from(dailyMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // ===== 7) Company Expense Summary (from vendors collection) =====
  const vendorsCollection = await getCollection("vendors");
  const vendors = await vendorsCollection.find({}).toArray();

  let officeExpenseBDT = 0;
  let vendorPaymentBDT = 0;
  let refundBDT = 0;

  for (const vendor of vendors) {
    const category = vendorExpenseCategory(vendor);
    for (const payment of vendor.paymentHistory || []) {
      if (!String(payment.date || "").startsWith(targetMonth)) continue;
      const amount = toNumber(payment.amountBDT);
      if (amount <= 0) continue;
      if (category === "office") officeExpenseBDT = round2(officeExpenseBDT + amount);
      else if (category === "refund") refundBDT = round2(refundBDT + amount);
      else vendorPaymentBDT = round2(vendorPaymentBDT + amount);
    }
  }

  const totalCompanyBDT = round2(officeExpenseBDT + vendorPaymentBDT + refundBDT);

  return {
    month: targetMonth,
    metrics: {
      totalSellUSD,
      totalSellBDT,
      avgSellUSD,
      avgSellBDT,
      adTopupUSD,
      adTopupBDT,
      avgPerDollarBDT,
    },
    approval: {
      total: count,
      approved: approvalApprovedCount,
      declined: approvalDeclinedCount,
      unapproved: approvalUnapprovedCount,
    },
    totals: {
      totalDueBDT: round2(monthInvoices.reduce((s, inv) => s + toNumber(inv.dueAmountBDT), 0)),
    },
    payment: {
      total: count,
      paid: paidStatus.count,
      due: dueStatus.count,
      partialPaid: partialPaidStatus.count,
    },
    paymentStatus,
    platformWise,
    channelWise,
    dailyWise,
    company: {
      officeExpenseBDT,
      vendorPaymentBDT,
      refundBDT,
      totalCompanyBDT,
    },
    ledger: monthInvoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      groupId: inv.groupId || inv.invoiceNo,
      customerId: inv.customerId || "Standard",
      adAccountName: inv.adAccountName,
      platform: inv.platform,
      topupAmountUSD: Number(inv.topupAmountUSD || 0),
      totalAmountBDT: Number(inv.totalAmountBDT || 0),
      paidAmountBDT: Number(inv.paidAmountBDT || 0),
      paymentMethod: inv.paymentMethod,
      paymentStatus: inv.paymentStatus,
      approvalStatus: inv.approvalStatus || "Approved",
    })),
  };
}

export async function getExportRows(month) {
  const report = await getMonthlyReport(month);
  const settings = await getSettings();
  const companyName = settings.companyName || "AdsBuzz Ltd";
  return { ...report, companyName };
}

/**
 * Builds an ad-account statement for a specific Group ID + Ad Account, derived
 * entirely from the Sales Entry (invoice) history. This intentionally ignores
 * the ad account's *current* assignment status: an ad account qualifies for a
 * statement as long as it has at least one sales entry recorded against the
 * given group — even if it was later unassigned (or is currently unassigned).
 */
export async function getAdAccountStatement(groupId, adAccountName) {
  const invoices = await listInvoices();
  const gid = String(groupId || "").trim();
  const name = String(adAccountName || "").trim();

  const entries = invoices.filter(
    (inv) =>
      String(inv.groupId || "").trim() === gid &&
      String(inv.adAccountName || "").trim() === name
  );

  const totalUSD = round2(entries.reduce((s, inv) => s + toNumber(inv.topupAmountUSD), 0));
  const totalBDT = round2(entries.reduce((s, inv) => s + toNumber(inv.totalAmountBDT || inv.paidAmountBDT), 0));
  const paidBDT = round2(entries.reduce((s, inv) => s + toNumber(inv.paidAmountBDT), 0));
  const dueBDT = round2(entries.reduce((s, inv) => s + toNumber(inv.dueAmountBDT), 0));
  const serviceFeeBDT = round2(entries.reduce((s, inv) => s + toNumber(inv.serviceFee), 0));

  const dates = entries
    .map((e) => String(e.date || e.createdAtRaw || "").slice(0, 10))
    .filter(Boolean)
    .sort();
  const periodFrom = dates[0] || "";
  const periodTo = dates[dates.length - 1] || "";

  const rows = entries
    .map((inv) => ({
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      platform: inv.platform,
      adAccountName: inv.adAccountName,
      topupAmountUSD: Number(inv.topupAmountUSD || 0),
      totalAmountBDT: Number(inv.totalAmountBDT || inv.paidAmountBDT || 0),
      paidAmountBDT: Number(inv.paidAmountBDT || 0),
      dueAmountBDT: Number(inv.dueAmountBDT || 0),
      paymentMethod: inv.paymentMethod,
      paymentStatus: inv.paymentStatus,
      approvalStatus: inv.approvalStatus || "Approved",
    }))
    .sort(
      (a, b) =>
        String(a.date || "").localeCompare(String(b.date || "")) ||
        String(a.invoiceNo).localeCompare(String(b.invoiceNo))
    );

  return {
    groupId: gid,
    adAccountName: name,
    count: entries.length,
    totalUSD,
    totalBDT,
    paidBDT,
    dueBDT,
    serviceFeeBDT,
    periodFrom,
    periodTo,
    entries: rows,
  };
}

const CSV_COLUMNS = [
  { key: "invoiceNo", label: "Invoice No" },
  { key: "date", label: "Date" },
  { key: "groupId", label: "Group Code" },
  { key: "customerId", label: "Customer" },
  { key: "adAccountName", label: "Ad Account" },
  { key: "platform", label: "Platform" },
  { key: "topupAmountUSD", label: "Topup USD" },
  { key: "totalAmountBDT", label: "Total BDT" },
  { key: "paidAmountBDT", label: "Paid BDT" },
  { key: "paymentMethod", label: "Payment Method" },
  { key: "paymentStatus", label: "Payment Status" },
  { key: "approvalStatus", label: "Approval Status" },
];

function csvCell(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function renderCSV(rows) {
  const header = CSV_COLUMNS.map((c) => c.label).join(",");
  const body = rows.map((row) => CSV_COLUMNS.map((c) => csvCell(row[c.key])).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function renderXLSXHtml(report) {
  const rows = report.ledger;
  const headerRow = CSV_COLUMNS.map((c) => `<th>${c.label}</th>`).join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${CSV_COLUMNS.map((c) => `<td>${csvCell(row[c.key])}</td>`).join("")}</tr>`
    )
    .join("");

  const summary = [
    `Total Sell USD: ${report.metrics.totalSellUSD}`,
    `Total Sell BDT: ${report.metrics.totalSellBDT}`,
    `Ads Topup USD: ${report.metrics.adTopupUSD}`,
    `Avg Per USD: ${report.metrics.avgPerDollarBDT}`,
    `Approved: ${report.approval.approved}`,
    `Declined: ${report.approval.declined}`,
    `Paid: ${report.payment.paid}`,
    `Due: ${report.payment.due}`,
    `Company Total BDT: ${report.company.totalCompanyBDT}`,
  ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<html xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Report ${report.month}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  th { background:#154A7D; color:#fff; font-weight:bold; padding:6px 10px; }
  td { border:1px solid #CBD5E1; padding:5px 10px; }
</style>
</head><body>
<h3>${report.companyName} — Monthly Statement (${report.month})</h3>
<p>${summary.join(" &nbsp;|&nbsp; ")}</p>
<table border="1" cellspacing="0"><tr>${headerRow}</tr>${bodyRows}</table>
</body></html>`;
}

export function renderPDFHtml(report) {
  const rows = report.ledger;
  const headerRow = CSV_COLUMNS.map((c) => `<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #E05305;color:#E05305;font-size:12px;font-weight:700;text-transform:uppercase;white-space:nowrap;">${c.label}</th>`).join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${CSV_COLUMNS.map((c) => `<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#374151;">${String(row[c.key] ?? "")}</td>`).join("")}</tr>`
    )
    .join("");

  const summaryHtml = `
    <div style="margin-bottom:20px;padding:16px;background:#fef5ee;border-radius:8px;border:1px solid #fed7aa;">
      <span style="display:inline-block;margin-right:20px;font-size:13px;"><strong>Total Sell USD:</strong> ${report.metrics.totalSellUSD}</span>
      <span style="display:inline-block;margin-right:20px;font-size:13px;"><strong>Total Sell BDT:</strong> ${report.metrics.totalSellBDT}</span>
      <span style="display:inline-block;margin-right:20px;font-size:13px;"><strong>Avg Per USD:</strong> ${report.metrics.avgPerDollarBDT}</span>
      <span style="display:inline-block;margin-right:20px;font-size:13px;"><strong>Approved:</strong> ${report.approval.approved}</span>
      <span style="display:inline-block;font-size:13px;"><strong>Paid:</strong> ${report.payment.paid}</span>
    </div>
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${report.companyName} — ${report.month}</title></head>
<body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;">
  <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #E05305;">
    <h1 style="font-size:22px;margin:0;color:#E05305;">${report.companyName}</h1>
    <p style="font-size:14px;color:#64748b;margin:4px 0 0;">Monthly Statement — ${report.month}</p>
    <p style="font-size:11px;color:#94a3b8;margin:4px 0 0;">Generated: ${new Date().toLocaleString()}</p>
  </div>
  ${summaryHtml}
  <table style="width:100%;border-collapse:collapse;margin-top:12px;">
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows || '<tr><td colspan="99" style="text-align:center;padding:20px;color:#94a3b8;">No data available</td></tr>'}</tbody>
  </table>
  <div style="text-align:center;margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#94a3b8;">
    AdsBuzz — Confidential
  </div>
</body></html>`;
}
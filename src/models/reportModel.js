import { getCollection } from "@/lib/db";
import { listInvoices } from "@/models/invoiceModel";
import { getSettings } from "@/models/settingsModel";
import logger from "@/utils/logger";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const OFFICE_EXPENSE_BDT = 20810;

function normalizeMonth(value) {
  const str = String(value || "").trim();
  if (/^\d{4}-\d{2}$/.test(str)) return str;
  return new Date().toISOString().slice(0, 7);
}

export async function getMonthlyReport(month) {
  const targetMonth = normalizeMonth(month);
  const invoices = await listInvoices();
  const monthInvoices = invoices.filter((inv) => String(inv.date || "").startsWith(targetMonth));

  const totalSellUSD = round2(monthInvoices.reduce((s, inv) => s + Number(inv.topupAmountUSD || 0), 0));
  const totalSellBDT = round2(monthInvoices.reduce((s, inv) => s + Number(inv.totalAmountBDT || inv.paidAmountBDT || 0), 0));

  const count = monthInvoices.length;
  const avgSellUSD = count > 0 ? round2(totalSellUSD / count) : 0;
  const avgSellBDT = count > 0 ? round2(totalSellBDT / count) : 0;

  const adTopupInvoices = monthInvoices.filter((inv) => inv.serviceType !== "Others");
  const adTopupUSD = round2(adTopupInvoices.reduce((s, inv) => s + Number(inv.topupAmountUSD || 0), 0));
  const adTopupBDT = round2(adTopupInvoices.reduce((s, inv) => s + Number(inv.totalAmountBDT || inv.paidAmountBDT || 0), 0));

  const avgPerDollarBDT = totalSellUSD > 0 ? round2(totalSellBDT / totalSellUSD) : 0;

  const approvalApprovedCount = monthInvoices.filter((inv) => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || "Approved";
    return a === "Approved";
  }).length;
  const approvalDeclinedCount = monthInvoices.filter((inv) => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || "Approved";
    return a === "Rejected" || a === "Declined";
  }).length;

  const paidCount = monthInvoices.filter((inv) => inv.paymentStatus === "Paid").length;
  const dueCount = monthInvoices.filter((inv) => inv.paymentStatus === "Due").length;
  const partialPaidCount = monthInvoices.filter((inv) => inv.paymentStatus === "Partially Paid").length;

  const vendorPaymentBDT = round2(monthInvoices.reduce((s, inv) => s + Number(inv.paidAmountBDT || 0), 0));
  const officeExpenseBDT = count > 0 ? OFFICE_EXPENSE_BDT : 0;
  const refundBDT = 0;
  const totalCompanyBDT = round2(vendorPaymentBDT + officeExpenseBDT + refundBDT);

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
    },
    payment: {
      total: count,
      paid: paidCount,
      due: dueCount,
      partialPaid: partialPaidCount,
    },
    company: {
      vendorPaymentBDT,
      officeExpenseBDT,
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

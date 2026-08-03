import { getCollection } from "@/lib/db";
import { listInvoices } from "@/models/invoiceModel";
import logger from "@/utils/logger";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const INVESTMENT_FACTOR = 0.92;

export async function getInsights() {
  const invoices = await listInvoices();

  const paidInvoices = invoices.filter((inv) => inv.paymentStatus === "Paid");

  const overallTopupUSD = round2(invoices.reduce((sum, inv) => sum + Number(inv.topupAmountUSD || 0), 0));
  const overallInvestmentUSD = round2(overallTopupUSD * INVESTMENT_FACTOR);
  const marginBalanceUSD = round2(overallTopupUSD - overallInvestmentUSD);
  const marginPercentage = overallTopupUSD > 0
    ? `${((marginBalanceUSD / overallTopupUSD) * 100).toFixed(1)}%`
    : "0.0%";

  const platformMap = {};
  for (const inv of paidInvoices) {
    const platform = inv.platform || "Facebook";
    platformMap[platform] = (platformMap[platform] || 0) + Number(inv.topupAmountUSD || 0);
  }
  const platformSpend = Object.entries(platformMap)
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);

  const channelMap = {};
  const dailyMap = {};
  for (const inv of invoices) {
    const channel = inv.paymentMethod || "Unknown";
    const amount = Number(inv.totalAmountBDT || inv.paidAmountBDT || 0);
    if (!channelMap[channel]) channelMap[channel] = { name: channel, qty: 0, amount: 0 };
    channelMap[channel].qty += 1;
    channelMap[channel].amount = round2(channelMap[channel].amount + amount);

    const date = inv.date || "";
    if (date) {
      if (!dailyMap[date]) dailyMap[date] = { date, usd: 0, bdt: 0 };
      dailyMap[date].usd = round2(dailyMap[date].usd + Number(inv.topupAmountUSD || 0));
      dailyMap[date].bdt = round2(dailyMap[date].bdt + Number(inv.totalAmountBDT || inv.paidAmountBDT || 0));
    }
  }
  const channelBreakdown = Object.values(channelMap).sort((a, b) => b.amount - a.amount);
  const dailyBreakdown = Object.values(dailyMap).sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const approvalStatus = {
    total: invoices.length,
    approved: invoices.filter((inv) => (inv.approvalStatus || inv.paymentVerificationStatus || "Approved") === "Approved").length,
    declined: invoices.filter((inv) => {
      const a = inv.approvalStatus || inv.paymentVerificationStatus || "Approved";
      return a === "Rejected" || a === "Declined";
    }).length,
    pending: invoices.filter((inv) => (inv.approvalStatus || "Approved") === "Pending").length,
  };

  const paymentStatus = {
    total: invoices.length,
    paid: invoices.filter((inv) => inv.paymentStatus === "Paid").length,
    partiallyPaid: invoices.filter((inv) => inv.paymentStatus === "Partially Paid").length,
    due: invoices.filter((inv) => inv.paymentStatus === "Due").length,
  };

  const accountMap = {};
  for (const inv of invoices) {
    const key = inv.adAccountId || inv.adAccountName;
    if (!key) continue;
    if (!accountMap[key]) {
      accountMap[key] = {
        adAccountId: inv.adAccountId || "",
        adAccountName: inv.adAccountName || "",
        platform: inv.platform || "Facebook",
        totalUSD: 0,
        totalBDT: 0,
        invoiceCount: 0,
        invoices: [],
      };
    }
    const entry = accountMap[key];
    entry.totalUSD = round2(entry.totalUSD + Number(inv.topupAmountUSD || 0));
    entry.totalBDT = round2(entry.totalBDT + Number(inv.totalAmountBDT || inv.paidAmountBDT || 0));
    entry.invoiceCount += 1;
    entry.invoices.push({
      invoiceNo: inv.invoiceNo,
      date: inv.date,
      dollarRate: inv.dollarRate,
      topupAmountUSD: inv.topupAmountUSD,
      totalAmountBDT: inv.totalAmountBDT,
      paymentStatus: inv.paymentStatus,
    });
  }
  const accountLedger = Object.values(accountMap).sort((a, b) => b.totalUSD - a.totalUSD);

  const totalBDT = invoices.reduce((sum, inv) => sum + Number(inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);
  const totalUSD = invoices.reduce((sum, inv) => sum + Number(inv.topupAmountUSD || 0), 0);
  const avgRate = totalUSD > 0 ? round2(totalBDT / totalUSD) : 0;

  const insights = {
    overall: {
      overallTopupUSD,
      overallInvestmentUSD,
      marginBalanceUSD,
      marginPercentage,
    },
    platformSpend,
    channelBreakdown,
    dailyBreakdown,
    approvalStatus,
    paymentStatus,
    accountLedger,
    avgRate,
  };

  logger.info(`getInsights: ${invoices.length} invoices analyzed.`);
  return insights;
}

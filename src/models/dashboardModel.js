import { getCollection } from "@/lib/db";
import { listInvoices } from "@/models/invoiceModel";
import { listActivities } from "@/models/activityModel";
import logger from "@/utils/logger";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function currentMonthPrefix() {
  return new Date().toISOString().slice(0, 7);
}

export async function getDashboardStats() {
  const invoices = await listInvoices();

  const today = todayString();
  const monthPrefix = currentMonthPrefix();

  const todaySales = round2(
    invoices
      .filter((inv) => inv.date === today && inv.paymentStatus === "Paid")
      .reduce((sum, inv) => sum + Number(inv.topupAmountUSD || 0), 0)
  );

  const monthlySales = round2(
    invoices
      .filter((inv) => inv.paymentStatus === "Paid" && String(inv.date || "").startsWith(monthPrefix))
      .reduce((sum, inv) => sum + Number(inv.topupAmountUSD || 0), 0)
  );

  const pendingTopups = invoices.filter((inv) => inv.topupStatus === "Pending").length;
  const pendingApprovals = invoices.filter((inv) => inv.approvalStatus === "Pending").length;

  const [customersCollection, adAccountsCollection, vendorsCollection] = await Promise.all([
    getCollection("customers"),
    getCollection("adAccounts"),
    getCollection("vendors"),
  ]);

  const [activeCustomers, activeAccounts, assignedAccounts, vendors] = await Promise.all([
    customersCollection.countDocuments({ status: "Active" }),
    adAccountsCollection.countDocuments({ accountStatus: "Active" }),
    adAccountsCollection.countDocuments({ assignedCustomer: { $exists: true, $ne: "" } }),
    vendorsCollection.find({}).toArray(),
  ]);

  const vendorDue = round2(
    vendors.reduce((sum, v) => sum + Number(v.outstandingBalanceUSD || 0), 0)
  );

  const recentInvoices = invoices.slice(0, 5);
  const recentActivities = await listActivities({ limit: 5 });

  logger.info("getDashboardStats: dashboard stats computed.");

  return {
    stats: {
      todaySales,
      monthlySales,
      pendingTopups,
      pendingApprovals,
      activeCustomers,
      activeAccounts,
      assignedAccounts,
      vendorDue,
    },
    recentInvoices,
    recentActivities,
  };
}
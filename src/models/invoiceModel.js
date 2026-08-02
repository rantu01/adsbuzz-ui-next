import { ObjectId } from "mongodb";
import { getCollection, getDb } from "@/lib/db";
import logger from "@/utils/logger";

export const DEFAULT_DOLLAR_RATE = 132;
export const DEFAULT_CREDIT_LIMIT = 1000;
export const INVOICE_PAYMENT_STATUS = ["Paid", "Due", "Partially Paid"];

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split("T")[0];
}

function detectPlatform(accountName = "") {
  const name = String(accountName).toUpperCase();
  if (name.includes("ATA")) return "TikTok";
  if (name.includes("ADG")) return "Google";
  if (name.includes("AD_") || name.includes("ADF_") || name.includes("ADS_")) return "Facebook";
  return "Facebook";
}

function invoiceNoFromLegacyId(legacyId) {
  const hex = String(legacyId).replace(/[^0-9a-f]/gi, "").slice(-6) || "0";
  const num = parseInt(hex, 16) % 1000000;
  return `ADB ${String(num).padStart(6, "0")}`;
}

/**
 * Builds invoice records for each real customer from the legacy data model
 * (mirrors how the original ad-buzz project computes/retrieves topups):
 *  - USD topups come from `balanceLogs` (type `ad_account_topup`, `metadata.topUpAmount`)
 *    attributed to the customer via uid, email, or the ad account they own.
 *  - BDT equivalent is charged at the customer's dollar rate, exactly like the
 *    new UI's invoice shape (`paidAmountBDT = topupAmountUSD * dollarRate`).
 *  - Approved `deposits` carry the actual BDT received in the old app; the BDT
 *    value above is the price charged for each topup in the new invoice ledger.
 *
 * Idempotent: each legacy record maps to one invoice via a `legacyId` key.
 * Also persists per-customer aggregates (`totalTopupUSD`, `totalTopupBDT`) and a
 * sensible default `creditLimitUSD` on the customer document.
 */
export async function syncLegacyInvoices() {
  const db = await getDb();
  const customersCollection = db.collection("customers");
  const balanceLogsCollection = db.collection("balanceLogs");
  const depositsCollection = db.collection("deposits");
  const adAccountsCollection = db.collection("adAccounts");
  const invoicesCollection = db.collection("invoices");

  const customers = await customersCollection.find({ role: "customer" }).toArray();
  if (customers.length === 0) {
    return { synced: 0, totals: [] };
  }

  const logs = await balanceLogsCollection
    .find({ type: "ad_account_topup" })
    .sort({ createdAt: 1 })
    .toArray();

  const accountIds = [...new Set(logs.map((l) => l.referenceId || l.metadata?.accountId).filter(Boolean))];
  const adAccounts = await adAccountsCollection
    .find({
      _id: {
        $in: accountIds.map((id) => {
          try {
            return new ObjectId(id);
          } catch {
            return id;
          }
        }),
      },
    })
    .toArray();
  const accountMap = new Map(adAccounts.map((a) => [a._id.toString(), a]));

  let synced = 0;
  const totals = [];

  for (const customer of customers) {
    const rate = Number(customer.dollarRate) > 0 ? Number(customer.dollarRate) : DEFAULT_DOLLAR_RATE;
    const customerEmail = String(customer.email || "").toLowerCase();

    let totalTopupUSD = 0;
    let totalTopupBDT = 0;

    for (const log of logs) {
      const amount = Number(log.metadata?.topUpAmount || 0);
      if (!(amount > 0)) continue;

      const account = accountMap.get(log.referenceId) || accountMap.get(log.metadata?.accountId);
      const logEmail = String(log.email || "").toLowerCase();
      const accountEmail = String(account?.email || "").toLowerCase();

      const belongsToCustomer =
        (log.uid && log.uid === customer.uid) ||
        (logEmail && logEmail === customerEmail) ||
        (account?.uid && account.uid === customer.uid) ||
        (accountEmail && accountEmail === customerEmail);

      if (!belongsToCustomer) continue;

      const paidBDT = round2(amount * rate);
      totalTopupUSD += amount;
      totalTopupBDT += paidBDT;

      const legacyId = `log_${log._id.toString()}`;
      const invoice = {
        legacyId,
        invoiceNo: invoiceNoFromLegacyId(legacyId),
        date: dateOnly(log.createdAt),
        platform: detectPlatform(log.metadata?.accountName || account?.metaAccountName || account?.name),
        adAccountName: log.metadata?.accountName || account?.metaAccountName || account?.name || "",
        serviceType: "Ad Account Topup",
        dollarRate: rate,
        topupAmountUSD: round2(amount),
        totalAmountBDT: paidBDT,
        paidAmountBDT: paidBDT,
        dueAmountBDT: 0,
        paymentStatus: "Paid",
        paymentMethod: "Legacy",
        topupStatus: "Successfull",
        approvalStatus: "Approved",
        customerId: customer.id,
        groupId: customer.groupId || "",
        note: log.description || "",
        source: "legacy_sync",
        createdAtRaw: log.createdAt,
        updatedAt: new Date(),
      };

      await invoicesCollection.updateOne(
        { legacyId },
        { $set: invoice },
        { upsert: true }
      );
      synced += 1;
    }

    const creditLimitUSD = Number(customer.creditLimitUSD) > 0
      ? Number(customer.creditLimitUSD)
      : DEFAULT_CREDIT_LIMIT;

    await customersCollection.updateOne(
      { id: customer.id },
      {
        $set: {
          totalTopupUSD: round2(totalTopupUSD),
          totalTopupBDT: round2(totalTopupBDT),
          creditLimitUSD,
          updatedAt: new Date(),
        },
      }
    );

    totals.push({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      totalTopupUSD: round2(totalTopupUSD),
      totalTopupBDT: round2(totalTopupBDT),
      creditLimitUSD,
    });
  }

  logger.info(`syncLegacyInvoices: ${synced} invoices synced across ${totals.length} customers.`);
  return { synced, totals };
}

export async function listInvoices({ search = "", paymentStatus = "", customerId = "" } = {}) {
  await syncLegacyInvoices();
  const invoicesCollection = await getCollection("invoices");

  const filter = {};
  if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
  if (customerId) filter.customerId = customerId;

  const cursor = invoicesCollection.find(filter).sort({ createdAtRaw: -1, date: -1 });
  const invoices = await cursor.toArray();

  let items = invoices;
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (inv) =>
        inv.invoiceNo?.toLowerCase().includes(q) ||
        inv.adAccountName?.toLowerCase().includes(q) ||
        inv.groupId?.toLowerCase().includes(q) ||
        inv.customerId?.toLowerCase().includes(q) ||
        inv.note?.toLowerCase().includes(q)
    );
  }

  return items;
}

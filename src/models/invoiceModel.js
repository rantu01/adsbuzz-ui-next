import { ObjectId } from "mongodb";
import { getCollection, getDb } from "@/lib/db";
import logger from "@/utils/logger";
import { getSettings } from "@/models/settingsModel";
import { markAccountSold } from "@/models/adAccountModel";
import { applyCardLoad, getCardByName } from "@/models/cardModel";
import { applyCustomerCredit } from "@/models/customerModel";
import { round2, dateOnly, detectPlatform, invoiceNoFromLegacyId, computePaymentStatus } from "@/utils/invoiceMath";

export const DEFAULT_DOLLAR_RATE = 132;
export const DEFAULT_CREDIT_LIMIT = 1000;
export const INVOICE_PAYMENT_STATUS = ["Paid", "Due", "Partially Paid"];

// The legacy migration below is expensive (per-customer x per-log scan + per-invoice
// upserts). It must never run on every list read. We de-duplicate it with a
// module-level promise and skip it entirely once the migration has already been
// persisted (detected via the presence of migrated legacy invoices).
let legacyInvoiceSyncPromise = null;

export function ensureLegacyInvoicesSynced() {
  if (legacyInvoiceSyncPromise) return legacyInvoiceSyncPromise;

  legacyInvoiceSyncPromise = (async () => {
    const db = await getDb();
    const invoicesCollection = db.collection("invoices");
    const legacyCount = await invoicesCollection.countDocuments({
      $or: [{ source: "legacy_sync" }, { legacyId: { $exists: true, $ne: "" } }],
    });
    if (legacyCount > 0) {
      return { cached: true, synced: 0, totals: [] };
    }
    return await syncLegacyInvoices();
  })().catch((error) => {
    logger.error("Legacy invoice sync failed.", error);
    legacyInvoiceSyncPromise = null;
    return { synced: 0, totals: [] };
  });

  return legacyInvoiceSyncPromise;
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
  await ensureLegacyInvoicesSynced();
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

async function getNextInvoiceNo() {
  const db = await getDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: "invoiceId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  const counter = result.value || result;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `ADB ${year}${month}${String(counter.seq).padStart(3, "0")}`;
}

function mapInvoice({ _id, ...rest }) {
  return { ...rest };
}

export async function createInvoice(data = {}) {
  const invoicesCollection = await getCollection("invoices");
  const settings = await getSettings();
  const defaultRate = Number(settings.defaultDollarRate) > 0 ? Number(settings.defaultDollarRate) : DEFAULT_DOLLAR_RATE;

  const dollarRate = Number(data.dollarRate) > 0 ? Number(data.dollarRate) : defaultRate;
  const topupAmountUSD = Math.round(Number(data.topupAmountUSD || 0) * 100) / 100;
  const totalAmountBDT = Math.round(Number(data.totalAmountBDT || topupAmountUSD * dollarRate) * 100) / 100;
  const paidAmountBDT = Math.round(Number(data.paidAmountBDT || 0) * 100) / 100;
  const dueAmountBDT = Math.round((Number(data.dueAmountBDT ?? (totalAmountBDT - paidAmountBDT)) || 0) * 100) / 100;
  const paymentStatus = data.paymentStatus || computePaymentStatus({ totalAmountBDT, paidAmountBDT, dueAmountBDT });
  const date = data.date || new Date().toISOString().split("T")[0];

  const invoice = {
    invoiceNo: await getNextInvoiceNo(),
    date,
    platform: data.platform || detectPlatform(data.adAccountName),
    adAccountName: String(data.adAccountName || "").trim(),
    adAccountId: String(data.adAccountId || "").trim(),
    serviceType: data.serviceType === "Others" ? "Others" : "Ad Account Topup",
    serviceDetails: data.serviceDetails ? String(data.serviceDetails).trim() : "",
    serviceFee: Number(data.serviceFee) > 0 ? Number(data.serviceFee) : 0,
    dollarRate,
    topupAmountUSD,
    totalAmountBDT,
    paidAmountBDT,
    dueAmountBDT,
    paymentStatus,
    paymentMethod: String(data.paymentMethod || "").trim() || "N/A",
    topupStatus: String(data.topupStatus || "Successfull"),
    approvalStatus: String(data.approvalStatus || "Approved"),
    customerId: String(data.customerId || "").trim(),
    groupId: String(data.groupId || "").trim(),
    note: String(data.note || "").trim(),
    paymentScreenshot: data.paymentScreenshot || "",
    source: "manual",
    createdAtRaw: new Date(),
    updatedAt: new Date(),
  };

  await invoicesCollection.insertOne(invoice);
  logger.info(`createInvoice: created ${invoice.invoiceNo} (${invoice.topupAmountUSD} USD)`);

  const account = invoice.adAccountId
    ? await markAccountSold(invoice.adAccountId, invoice.customerId)
    : null;

  const cardName = account?.billingCard || data.billingCard;
  if (cardName) {
    const card = await getCardByName(cardName);
    if (card) {
      await applyCardLoad(cardName, invoice.topupAmountUSD);
    }
  }

  if (invoice.customerId) {
    await applyCustomerCredit(invoice.customerId, invoice.paidAmountBDT, invoice.topupAmountUSD);
  }

  return mapInvoice(invoice);
}

export async function listPendingTopups({ search = "" } = {}) {
  await ensureLegacyInvoicesSynced();
  const invoicesCollection = await getCollection("invoices");

  const filter = {
    $or: [{ approvalStatus: "Pending" }, { topupStatus: "Pending" }],
  };
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
        inv.customerId?.toLowerCase().includes(q)
    );
  }

  return items;
}

export async function getInvoiceByNo(invoiceNo) {
  const invoicesCollection = await getCollection("invoices");
  const doc = await invoicesCollection.findOne({ invoiceNo });
  if (!doc) return null;
  return { ...mapInvoice(doc), _id: doc._id };
}

export async function updateInvoice(invoiceNo, data = {}) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  const allowed = [
    "date",
    "platform",
    "adAccountName",
    "adAccountId",
    "serviceType",
    "serviceDetails",
    "serviceFee",
    "dollarRate",
    "topupAmountUSD",
    "totalAmountBDT",
    "paidAmountBDT",
    "dueAmountBDT",
    "paymentStatus",
    "paymentMethod",
    "topupStatus",
    "approvalStatus",
    "customerId",
    "groupId",
    "note",
    "paymentScreenshot",
  ];

  const patch = {};
  for (const key of allowed) {
    if (data[key] === undefined) continue;
    const value = data[key];
    if (key === "dollarRate") patch.dollarRate = Number(value) > 0 ? Number(value) : existing.dollarRate;
    else if (key === "topupAmountUSD") patch.topupAmountUSD = Math.round(Number(value || 0) * 100) / 100;
    else if (key === "totalAmountBDT") patch.totalAmountBDT = Math.round(Number(value || 0) * 100) / 100;
    else if (key === "paidAmountBDT") patch.paidAmountBDT = Math.round(Number(value || 0) * 100) / 100;
    else if (key === "dueAmountBDT") patch.dueAmountBDT = Math.round(Number(value || 0) * 100) / 100;
    else if (key === "serviceFee") patch.serviceFee = Number(value) > 0 ? Number(value) : 0;
    else if (key === "serviceType") patch.serviceType = value === "Others" ? "Others" : "Ad Account Topup";
    else if (key === "paymentStatus") patch.paymentStatus = value;
    else if (key === "topupStatus") patch.topupStatus = String(value);
    else if (key === "approvalStatus") patch.approvalStatus = String(value);
    else if (key === "paymentScreenshot") patch.paymentScreenshot = String(value || "");
    else patch[key] = String(value ?? "").trim();
  }

  if (data.paymentStatus === undefined && data.paidAmountBDT !== undefined) {
    patch.paymentStatus = computePaymentStatus({
      totalAmountBDT: patch.totalAmountBDT ?? existing.totalAmountBDT,
      paidAmountBDT: patch.paidAmountBDT,
      dueAmountBDT: patch.dueAmountBDT ?? existing.dueAmountBDT,
    });
  }

  patch.updatedAt = new Date();
  await invoicesCollection.updateOne({ invoiceNo }, { $set: patch });
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

export async function approveInvoice(invoiceNo) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.updateOne(
    { invoiceNo },
    { $set: { approvalStatus: "Approved", paymentStatus: "Paid", dueAmountBDT: 0, updatedAt: new Date() } }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

export async function rejectInvoice(invoiceNo) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.updateOne(
    { invoiceNo },
    { $set: { approvalStatus: "Rejected", paymentStatus: "Due", updatedAt: new Date() } }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

export async function syncTopupStatus(invoiceNo, status) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.updateOne(
    { invoiceNo },
    { $set: { topupStatus: String(status || "Pending"), updatedAt: new Date() } }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

import { ObjectId } from "mongodb";
import { getCollection, getDb } from "@/lib/db";
import logger from "@/utils/logger";
import { getSettings } from "@/models/settingsModel";
import { markAccountSold } from "@/models/adAccountModel";
import { applyCardLoad, getCardByName } from "@/models/cardModel";
import { applyCustomerCredit } from "@/models/customerModel";
import { normalizeCustomerId } from "@/utils/customerIds";
import { round2, dateOnly, detectPlatform, invoiceNoFromLegacyId, computePaymentStatus, applyPayment } from "@/utils/invoiceMath";
import { persistDataUrl } from "@/utils/upload";

export const DEFAULT_DOLLAR_RATE = 132;
export const DEFAULT_CREDIT_LIMIT = 1000;
export const INVOICE_PAYMENT_STATUS = ["Paid", "Due", "Partially Paid"];

// Topup audit workflow states. `Rejected` is a legacy state kept for
// backward compatibility with old data; new audits use the full workflow.
export const AUDIT_ACTIVE_STATES = ["Pending", "Waiting For Feedback", "Final Approval Review"];
export const AUDIT_STATUSES = [
  ...AUDIT_ACTIVE_STATES,
  "Approved",
  "Finally Rejected",
  "Rejected",
];

/**
 * Builds a single audit log entry. Kept small and stable so the View Log modal
 * can render a clean timeline (creation, approvals, rejections, feedback,
 * final actions) with actor + timestamp.
 */
function auditEntry(action, status, { reason = "", actor = null } = {}) {
  return {
    action,
    status,
    reason: reason ? String(reason).trim() : "",
    actor: actor || null,
    at: new Date().toISOString(),
  };
}

// The legacy migration below is expensive (per-customer x per-log scan + per-invoice
// upserts). It must never run on every list read. We de-duplicate it with a
// module-level promise and skip it entirely once the migration has already been
// persisted (detected via the presence of migrated legacy invoices).
let legacyInvoiceSyncPromise = null;

const INVOICE_INDEXES = [
  { key: { createdAtRaw: -1, date: -1 }, name: "invoices_createdAt_date" },
  { key: { date: 1 }, name: "invoices_date_asc" },
  { key: { approvalStatus: 1, createdAtRaw: -1 }, name: "invoices_approval_status" },
  { key: { topupStatus: 1 }, name: "invoices_topup_status" },
  { key: { paymentStatus: 1 }, name: "invoices_payment_status" },
  { key: { customerId: 1 }, name: "invoices_customer_id" },
  { key: { source: 1 }, name: "invoices_source" },
];

/**
 * Best-effort, idempotent index creation for the invoice collection. The shared
 * MongoDB instance is pathologically slow for unindexed scans/sorts, so the
 * list queries (Topups, Invoices, Reports) rely on these to stay fast.
 */
export async function ensureInvoicesIndexes() {
  const invoicesCollection = await getCollection("invoices");
  await Promise.all(
    INVOICE_INDEXES.map(({ key, name }) => invoicesCollection.createIndex(key, { name }))
  );
  return { ok: true };
}

// Read-path index creation. This is idempotent and never modifies invoice
// documents — it only ensures query/sort indexes exist so list reads stay
// fast. Memoized per process so the (cheap) index build runs at most once.
let indexesPromise = null;
export function ensureInvoicesIndexesOnce() {
  if (!indexesPromise) {
    indexesPromise = ensureInvoicesIndexes().catch((error) => {
      logger.error("ensureInvoicesIndexes failed.", error);
      indexesPromise = null;
    });
  }
  return indexesPromise;
}

/**
 * Historically, some invoices embedded full base64 image data URLs in
 * `paymentScreenshot` (2-3 MB each) when the upload fallback fired during a
 * sale. Those embedded payloads made every list read transfer megabytes of
 * image data, stalling the Topups/Invoices pages for minutes on throttled
 * connections. This persists each embedded screenshot as a normal upload file
 * (a plain `/uploads/...` URL, exactly what the View Screenshot modal renders)
 * and rewrites the invoice to reference the file. Idempotent and non-destructive.
 */
export async function migrateEmbeddedPaymentScreenshots() {
  const invoicesCollection = await getCollection("invoices");
  const docs = await invoicesCollection
    .find({ paymentScreenshot: { $regex: "^data:" } })
    .toArray();

  let migrated = 0;
  for (const doc of docs) {
    const url = await persistDataUrl({
      data: doc.paymentScreenshot,
      name: `${doc.invoiceNo || "screenshot"}.png`,
    });
    if (!url) continue;
    await invoicesCollection.updateOne(
      { _id: doc._id },
      { $set: { paymentScreenshot: url, updatedAt: new Date() } }
    );
    migrated += 1;
  }

  if (migrated > 0) {
    logger.info(`migrateEmbeddedPaymentScreenshots: ${migrated} embedded screenshot(s) moved to upload files.`);
  }
  return { migrated };
}

export function ensureLegacyInvoicesSynced() {
  if (legacyInvoiceSyncPromise) return legacyInvoiceSyncPromise;

  legacyInvoiceSyncPromise = (async () => {
    const db = await getDb();
    const invoicesCollection = db.collection("invoices");

    // Index + payload maintenance: idempotent, best-effort, never blocks reads.
    try {
      await ensureInvoicesIndexes();
    } catch (error) {
      logger.error("ensureInvoicesIndexes failed.", error);
    }
    try {
      await migrateEmbeddedPaymentScreenshots();
    } catch (error) {
      logger.error("migrateEmbeddedPaymentScreenshots failed.", error);
    }

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
  const adAccountsCollection = db.collection("socialAdAccounts");
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
        {
          $set: invoice,
          $setOnInsert: {
            auditLog: [auditEntry("created", "Approved", { actor: null, reason: invoice.note || "" })],
          },
        },
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
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const filter = {};
  if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
  if (customerId) filter.customerId = customerId;

  const cursor = invoicesCollection
    .find(filter)
    // Exclude the heavy `screenshots` array (base64 data URLs) from list
    // reads. Those blobs can be multiple MB each and were making the list
    // response so large it timed out. A single invoice's screenshots are still
    // available on demand via GET /api/invoices/[invoiceNo]. This is a
    // read-only projection — it never modifies stored documents.
    .project({ screenshots: 0 })
    .sort({ createdAtRaw: -1, date: -1 });
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

/**
 * DB-level paginated invoice query. Unlike `listInvoices` (which pulls the
 * whole collection into memory), this pushes the filter + skip/limit down to
 * MongoDB so each request only transfers the slice the caller actually needs.
 * `limit === 0` is a sentinel meaning "return everything" (used by the
 * analytics pages that still need the full ledger for cross-record math).
 */
export async function queryInvoices({ filter = {}, page = 1, limit = 20 } = {}) {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const total = await invoicesCollection.countDocuments(filter);

  let data;
  if (limit === 0) {
    data = await invoicesCollection
      .find(filter)
      .project({ screenshots: 0 })
      .sort({ date: 1 })
      .toArray();
  } else {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 20;
    data = await invoicesCollection
      .find(filter)
      .project({ screenshots: 0 })
      .sort({ date: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .toArray();
  }

  const effectiveLimit = limit === 0 ? Math.max(total, 1) : limit;
  const totalPages = limit === 0 ? 1 : Math.max(1, Math.ceil(total / limit));

  return {
    items: data,
    total,
    page: limit === 0 ? 1 : page,
    limit: effectiveLimit,
    totalPages,
  };
}

function formatMonthLabel(monthStr) {
  const [y, m] = String(monthStr || "").split("-");
  if (!y || !m) return "";
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function isOtherService(inv) {
  return (
    inv.serviceType === "Others" ||
    (inv.adAccountName || "").toLowerCase().includes("other") ||
    !!inv.serviceDetails
  );
}

function bdtOf(inv) {
  return Number(inv.totalAmountBDT || inv.paidAmountBDT || 0);
}

/**
 * Collection-wide aggregates for the Invoices overview cards and the dashboard
 * fallback. Computed over the FULL invoice collection (independent of the
 * list's search/status/page filter) so the summary numbers stay accurate even
 * though the table only shows one page. Mirrors the exact math the Invoices
 * view used to do client-side over the entire array.
 */
export async function computeInvoiceAggregates() {
  const invoicesCollection = await getCollection("invoices");
  const docs = await invoicesCollection
    .find({})
    .project({
      date: 1,
      topupAmountUSD: 1,
      totalAmountBDT: 1,
      paidAmountBDT: 1,
      dueAmountBDT: 1,
      paymentStatus: 1,
      approvalStatus: 1,
      topupStatus: 1,
      serviceType: 1,
      adAccountName: 1,
      serviceDetails: 1,
    })
    .sort({ createdAtRaw: -1, date: -1 })
    .toArray();

  const today = new Date().toISOString().split("T")[0];
  const monthPrefix = today.slice(0, 7);
  const yearPrefix = today.slice(0, 4);

  const hasCurrentMonth = docs.some((i) => i.date && i.date.startsWith(monthPrefix));
  const hasToday = docs.some((i) => i.date === today);
  const firstDate = docs[0]?.date || "";
  const activeMonthStr = hasCurrentMonth ? monthPrefix : firstDate ? firstDate.slice(0, 7) : monthPrefix;
  const activeTodayStr = hasToday ? today : firstDate || today;

  const sumBucket = (pred) => {
    let count = 0;
    let usd = 0;
    let bdtSum = 0;
    let othersUsd = 0;
    let othersBdt = 0;
    for (const inv of docs) {
      if (!pred(inv)) continue;
      count += 1;
      const u = Number(inv.topupAmountUSD || 0);
      usd += u;
      const b = bdtOf(inv);
      bdtSum += b;
      if (isOtherService(inv)) {
        othersUsd += u;
        othersBdt += b;
      }
    }
    return {
      count,
      usd: round2(usd),
      bdt: round2(bdtSum),
      othersUsd: round2(othersUsd),
      othersBdt: round2(othersBdt),
    };
  };

  const lifetime = sumBucket(() => true);
  const currentMonth = sumBucket((i) => i.date && i.date.startsWith(activeMonthStr));
  const daily = sumBucket((i) => i.date === activeTodayStr);
  const currentYear = sumBucket((i) => i.date && i.date.startsWith(yearPrefix));

  const paymentBucket = (status, amountKey) => {
    const items = docs.filter((i) => i.paymentStatus === status);
    return {
      count: items.length,
      bdt: round2(items.reduce((s, i) => s + Number(i[amountKey] || 0), 0)),
    };
  };

  return {
    lifetime,
    currentMonth: { ...currentMonth, label: formatMonthLabel(activeMonthStr), monthStr: activeMonthStr },
    daily: { ...daily, date: activeTodayStr },
    currentYear,
    paymentStatus: {
      paid: paymentBucket("Paid", "paidAmountBDT"),
      partiallyPaid: paymentBucket("Partially Paid", "paidAmountBDT"),
      due: paymentBucket("Due", "dueAmountBDT"),
    },
    pendingApprovals: docs.filter((i) => i.approvalStatus === "Pending").length,
    pendingTopups: docs.filter((i) => i.topupStatus === "Pending").length,
    paidTodayUsd: round2(
      docs
        .filter((i) => i.date === today && i.paymentStatus === "Paid")
        .reduce((s, i) => s + Number(i.topupAmountUSD || 0), 0),
    ),
    paidCurrentMonthUsd: round2(
      docs
        .filter((i) => String(i.date || "").startsWith(monthPrefix) && i.paymentStatus === "Paid")
        .reduce((s, i) => s + Number(i.topupAmountUSD || 0), 0),
    ),
  };
}

/**
 * Real lifetime + current-month topup totals for a customer, computed from the
 * actual invoice collection (legacy-synced + manual sales). Never hardcoded.
 */
export async function getCustomerTopupSummary(customerId) {
  if (!customerId) return null;
  const db = await getDb();
  const invoicesCollection = db.collection("invoices");
  // Historical backfilled entries are excluded so they never change the live
  // lifetime/current-month topup figures used for credit and billing decisions.
  const invoices = await invoicesCollection.find({ customerId, source: { $ne: "historical" } }).toArray();

  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let lifetimeTotalTopupUSD = 0;
  let lifetimeTotalTopupBDT = 0;
  let currentMonthTotalTopupUSD = 0;
  let currentMonthTotalTopupBDT = 0;
  let lifetimeTopupCount = 0;
  let currentMonthTopupCount = 0;

  for (const inv of invoices) {
    const usd = Number(inv.topupAmountUSD || 0);
    const bdt = Number(inv.totalAmountBDT || inv.paidAmountBDT || 0);
    lifetimeTotalTopupUSD += usd;
    lifetimeTotalTopupBDT += bdt;
    lifetimeTopupCount += 1;

    const d = String(inv.date || inv.createdAtRaw || "").slice(0, 7);
    if (d === monthPrefix) {
      currentMonthTotalTopupUSD += usd;
      currentMonthTotalTopupBDT += bdt;
      currentMonthTopupCount += 1;
    }
  }

  return {
    customerId,
    lifetimeTotalTopupUSD: round2(lifetimeTotalTopupUSD),
    lifetimeTotalTopupBDT: round2(lifetimeTotalTopupBDT),
    currentMonthTotalTopupUSD: round2(currentMonthTotalTopupUSD),
    currentMonthTotalTopupBDT: round2(currentMonthTotalTopupBDT),
    lifetimeTopupCount,
    currentMonthTopupCount,
  };
}

async function getNextInvoiceNo(date = new Date()) {
  const db = await getDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: "invoiceId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  const counter = result.value || result;
  const now = new Date(date);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `ADB ${year}${month}${String(counter.seq).padStart(3, "0")}`;
}

/**
 * Reads the next invoice number WITHOUT consuming the counter. Used by the
 * Sales page live-invoice preview so the number shown matches the one that
 * will actually be assigned on submit (barring concurrent sales).
 */
export async function peekNextInvoiceNo() {
  const db = await getDb();
  const counter = await db.collection("counters").findOne({ _id: "invoiceId" });
  const seq = Number(counter?.seq || 0) + 1;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `ADB ${year}${month}${String(seq).padStart(3, "0")}`;
}

function mapInvoice({ _id, ...rest }) {
  const customerId = normalizeCustomerId(rest.customerId);
  return { ...rest, customerId: customerId || rest.customerId };
}

/**
 * Aggregated, read-only Sales Entry reports computed from the real invoice
 * collection. Returns day-wise and month-wise entry counts and sales amounts
 * (USD + BDT) so the Sales page can verify how many entries and how much was
 * sold on each day / in each month. Does not mutate any documents.
 */
export async function getSalesEntryReport() {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const docs = await invoicesCollection
    .find({})
    .project({ date: 1, topupAmountUSD: 1, totalAmountBDT: 1, paidAmountBDT: 1 })
    .toArray();

  const dayMap = new Map();
  const monthMap = new Map();

  const dayKeyOf = (d) => String(d || "").slice(0, 10);
  const monthKeyOf = (d) => String(d || "").slice(0, 7);

  for (const inv of docs) {
    const dayKey = dayKeyOf(inv.date);
    const monthKey = monthKeyOf(inv.date);
    if (!dayKey && !monthKey) continue;

    const usd = Number(inv.topupAmountUSD || 0);
    const bdt = Number(inv.totalAmountBDT || inv.paidAmountBDT || 0);

    if (dayKey) {
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, { date: dayKey, count: 0, totalUSD: 0, totalBDT: 0 });
      const e = dayMap.get(dayKey);
      e.count += 1;
      e.totalUSD += usd;
      e.totalBDT += bdt;
    }
    if (monthKey) {
      if (!monthMap.has(monthKey)) monthMap.set(monthKey, { month: monthKey, count: 0, totalUSD: 0, totalBDT: 0 });
      const m = monthMap.get(monthKey);
      m.count += 1;
      m.totalUSD += usd;
      m.totalBDT += bdt;
    }
  }

  const dayWise = Array.from(dayMap.values())
    .map((d) => ({ ...d, totalUSD: round2(d.totalUSD), totalBDT: round2(d.totalBDT) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const monthWise = Array.from(monthMap.values())
    .map((m) => ({ ...m, totalUSD: round2(m.totalUSD), totalBDT: round2(m.totalBDT) }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  return { dayWise, monthWise, total: docs.length };
}

/**
 * Date-range (day-wise) Sales Entry report. Aggregates the real invoice
 * (Sales Entry) collection into one row per calendar date within the inclusive
 * [from, to] range. Used by the Reporting Desk "Date-Wise Sales Report" so a
 * user can view the full month (or any custom range) day by day directly on
 * the page. Read-only — it never mutates invoice documents.
 */
export async function getDailySalesReport({ from = "", to = "" } = {}) {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const filter = {};
  if (from || to) {
    const dateFilter = {};
    if (from) dateFilter.$gte = String(from).slice(0, 10);
    if (to) dateFilter.$lte = String(to).slice(0, 10);
    filter.date = dateFilter;
  }

  const docs = await invoicesCollection
    .find(filter)
    .project({ date: 1, topupAmountUSD: 1, totalAmountBDT: 1, paidAmountBDT: 1, dueAmountBDT: 1 })
    .sort({ date: 1 })
    .toArray();

  const dayMap = new Map();
  for (const inv of docs) {
    const dayKey = String(inv.date || "").slice(0, 10);
    if (!dayKey) continue;
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { date: dayKey, count: 0, totalUSD: 0, totalBDT: 0, paidBDT: 0, dueBDT: 0 });
    }
    const d = dayMap.get(dayKey);
    d.count += 1;
    d.totalUSD += Number(inv.topupAmountUSD || 0);
    d.totalBDT += Number(inv.totalAmountBDT || inv.paidAmountBDT || 0);
    d.paidBDT += Number(inv.paidAmountBDT || 0);
    d.dueBDT += Number(inv.dueAmountBDT || 0);
  }

  const dailyWise = Array.from(dayMap.values())
    .map((d) => ({
      date: d.date,
      count: d.count,
      totalUSD: round2(d.totalUSD),
      totalBDT: round2(d.totalBDT),
      paidBDT: round2(d.paidBDT),
      dueBDT: round2(d.dueBDT),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totals = dailyWise.reduce(
    (acc, d) => {
      acc.count += d.count;
      acc.totalUSD += d.totalUSD;
      acc.totalBDT += d.totalBDT;
      acc.paidBDT += d.paidBDT;
      acc.dueBDT += d.dueBDT;
      return acc;
    },
    { count: 0, totalUSD: 0, totalBDT: 0, paidBDT: 0, dueBDT: 0 },
  );

  return { from: from || "", to: to || "", dailyWise, totals };
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
  const approvalStatus = String(data.approvalStatus || "Pending");

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
    approvalStatus,
    customerId: String(data.customerId || "").trim(),
    groupId: String(data.groupId || "").trim(),
    note: String(data.note || "").trim(),
    paymentScreenshot: data.paymentScreenshot || "",
    screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
    source: "manual",
    auditLog: [
      auditEntry("created", approvalStatus, { actor: data.auditActor || null, reason: String(data.note || "") }),
    ],
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

/**
 * Creates a historical sales invoice for a sale that happened BEFORE this
 * system was in use. It mirrors the manual-sale invoice shape so records are
 * consistent, but deliberately avoids every side effect of a live sale:
 *  - the ad account is NOT marked Sold,
 *  - the billing card load is NOT increased,
 *  - the customer credit/balance is NOT re-applied,
 *  - the record is created already "Approved" so it never enters the audit queue.
 * The entry therefore lives purely in the sales records/history and cannot
 * distort current balances, approvals, or the live sales flow.
 */
export async function createHistoricalInvoice(data = {}) {
  const invoicesCollection = await getCollection("invoices");
  const settings = await getSettings();
  const defaultRate = Number(settings.defaultDollarRate) > 0 ? Number(settings.defaultDollarRate) : DEFAULT_DOLLAR_RATE;

  // Historical sales must be dated strictly in the past.
  const date = dateOnly(data.date || "");
  if (!date) {
    const err = new Error("Historical sale date is required.");
    err.code = "INVALID_HISTORICAL_DATE";
    throw err;
  }
  const chosen = new Date(`${date}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(chosen.getTime()) || chosen.getTime() >= today.getTime()) {
    const err = new Error("Historical sale date must be before today.");
    err.code = "INVALID_HISTORICAL_DATE";
    throw err;
  }

  const dollarRate = Number(data.dollarRate) > 0 ? Number(data.dollarRate) : defaultRate;
  const topupAmountUSD = Math.round(Number(data.topupAmountUSD || 0) * 100) / 100;
  const totalAmountBDT = Math.round(Number(data.totalAmountBDT || topupAmountUSD * dollarRate) * 100) / 100;
  const paidAmountBDT = Math.round(Number(data.paidAmountBDT || 0) * 100) / 100;
  const dueAmountBDT = Math.round((Number(data.dueAmountBDT ?? (totalAmountBDT - paidAmountBDT)) || 0) * 100) / 100;
  const paymentStatus = data.paymentStatus || computePaymentStatus({ totalAmountBDT, paidAmountBDT, dueAmountBDT });
  const approvalStatus = "Approved";

  const invoice = {
    invoiceNo: await getNextInvoiceNo(date),
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
    approvalStatus,
    customerId: String(data.customerId || "").trim(),
    groupId: String(data.groupId || "").trim(),
    note: String(data.note || "").trim(),
    paymentScreenshot: data.paymentScreenshot || "",
    screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
    source: "historical",
    auditLog: [
      auditEntry("created", approvalStatus, { actor: data.auditActor || null, reason: String(data.note || "") }),
    ],
    createdAtRaw: chosen,
    updatedAt: new Date(),
  };

  await invoicesCollection.insertOne(invoice);
  logger.info(`createHistoricalInvoice: created ${invoice.invoiceNo} (${invoice.topupAmountUSD} USD) for ${invoice.date}`);

  return mapInvoice(invoice);
}

/**
 * Topup ledger. Every invoice is a topup record. Passing `onlyPending: true`
 * restricts to records still awaiting finance approval or API sync (the audit
 * queue); the default returns the full topup history so new sales from the
 * Sales page are always visible on the Topups page.
 */
export async function listTopups({ search = "", onlyPending = false } = {}) {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const filter = onlyPending
    ? {
        $or: [
          { approvalStatus: { $in: AUDIT_ACTIVE_STATES } },
          { topupStatus: "Pending" },
        ],
      }
    : {};
  const cursor = invoicesCollection
    .find(filter)
    // Exclude the heavy `screenshots` array (base64 data URLs) from list
    // reads. Those blobs can be multiple MB each and were making the list
    // response so large it timed out. A single invoice's screenshots are still
    // available on demand via GET /api/invoices/[invoiceNo]. This is a
    // read-only projection — it never modifies stored documents.
    .project({ screenshots: 0 })
    .sort({ createdAtRaw: -1, date: -1 });
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

export async function listPendingTopups({ search = "" } = {}) {
  return listTopups({ search, onlyPending: true });
}

/**
 * Searches the real Sales Entry data (invoice collection) by Ad Account ID or
 * Ad Account Name and returns every matching sales record together with a
 * derived list of all distinct dates on which entries were made for the matched
 * account(s). Used by the Sales page "Search by Ad Account" verification panel
 * so a user can confirm which dates already have sales entries and spot any
 * missing or incorrect ones. Read-only — it never mutates invoice documents.
 */
export async function searchSalesByAdAccount({ query = "", limit = 0 } = {}) {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const q = String(query || "").trim();
  if (!q) {
    return { query: q, entries: [], dates: [], total: 0 };
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const filter = {
    $or: [
      { adAccountId: { $regex: escaped, $options: "i" } },
      { adAccountName: { $regex: escaped, $options: "i" } },
    ],
  };

  const docs = await invoicesCollection
    .find(filter)
    .project({ screenshots: 0 })
    .sort({ date: 1, createdAtRaw: 1 })
    .toArray();

  const entries = docs.map(({ _id, ...rest }) => mapInvoice(rest));

  // Group entries by date so each calendar date with a sales entry is surfaced
  // exactly once, with how many entries and which invoice numbers belong to it.
  const byDate = new Map();
  for (const entry of entries) {
    const date = String(entry.date || "").slice(0, 10);
    if (!date) continue;
    if (!byDate.has(date)) {
      byDate.set(date, { date, entries: [], totalUSD: 0, totalBDT: 0 });
    }
    const bucket = byDate.get(date);
    bucket.entries.push(entry);
    bucket.totalUSD += Number(entry.topupAmountUSD || 0);
    bucket.totalBDT += Number(entry.totalAmountBDT || entry.paidAmountBDT || 0);
  }

  const dates = Array.from(byDate.values())
    .map((d) => ({
      date: d.date,
      count: d.entries.length,
      totalUSD: round2(d.totalUSD),
      totalBDT: round2(d.totalBDT),
      invoiceNos: d.entries.map((e) => e.invoiceNo),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    query: q,
    entries,
    dates,
    total: entries.length,
  };
}

/**
 * Fetches only the invoices for a given YYYY-MM month using a server-side date
 * range and a minimal projection (just the fields reports/aggregations need).
 * This avoids pulling the entire collection's full documents (which include
 * heavy `auditLog`/`payments`/`screenshots` blobs) — on the shared,
 * latency-prone MongoDB that full fetch is pathologically slow (minutes for a
 * few hundred records). Returns only what the monthly report math requires.
 */
export async function getInvoicesByMonth(month) {
  await ensureInvoicesIndexesOnce();
  const invoicesCollection = await getCollection("invoices");

  const str = String(month || "").trim();
  const [y, m] = str.split("-");
  const year = Number(y);
  const mon = Number(m);
  if (!year || !mon) return [];

  const lastDay = new Date(year, mon, 0).getDate();
  const start = `${str}-01`;
  const end = `${str}-${String(lastDay).padStart(2, "0")}`;

  const docs = await invoicesCollection
    .find({ date: { $gte: start, $lte: end } })
    .project({
      date: 1,
      topupAmountUSD: 1,
      totalAmountBDT: 1,
      paidAmountBDT: 1,
      dueAmountBDT: 1,
      paymentStatus: 1,
      approvalStatus: 1,
      paymentVerificationStatus: 1,
      platform: 1,
      serviceType: 1,
      paymentMethod: 1,
      groupId: 1,
      adAccountName: 1,
      customerId: 1,
      invoiceNo: 1,
      payments: 1,
      serviceFee: 1,
      source: 1,
    })
    .toArray();

  return docs.map(({ _id, ...rest }) => mapInvoice(rest));
}

export async function getInvoiceByNo(invoiceNo) {
  const invoicesCollection = await getCollection("invoices");
  const doc = await invoicesCollection.findOne({ invoiceNo });
  if (!doc) return null;
  return { ...mapInvoice(doc), _id: doc._id };
}

export async function deleteInvoice(invoiceNo) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.deleteOne({ invoiceNo });
  logger.info(`deleteInvoice: deleted ${invoiceNo} (${existing.topupAmountUSD} USD)`);
  return mapInvoice(existing);
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
  await invoicesCollection.updateOne(
    { invoiceNo },
    {
      $set: patch,
      $push: {
        auditLog: auditEntry("edited", patch.approvalStatus || existing.approvalStatus, {
          actor: data.auditActor || null,
        }),
      },
    }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

/**
 * Records a BDT payment against an invoice with a remaining due balance.
 * Recomputes paid/due/payment status, persists the payment entry, pushes a
 * `payment_received` audit log entry (actor + timestamp + amount), and credits
 * the customer's BDT balance with the newly received amount (the USD was
 * already credited at sale creation).
 *
 * Only invoices with a payment status of "Due" or "Partially Paid" (remaining
 * due > 0) accept payments; paying more than the outstanding balance is
 * rejected. Already-paid invoices throw an `INVOICE_FULLY_PAID` code so the
 * API can respond 400 instead of silently mutating settled records.
 */
export async function recordInvoicePayment(invoiceNo, { amountBDT = 0, paymentMethod = "", date = "", transactionId = "", note = "", screenshot = "", actor = null } = {}) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  const total = round2(Number(existing.totalAmountBDT) || 0);
  const paid = round2(Number(existing.paidAmountBDT) || 0);
  const due = round2(Number(existing.dueAmountBDT) || Math.max(0, total - paid));
  const amount = round2(Number(amountBDT) || 0);

  if (!(amount > 0)) {
    const err = new Error("Payment amount must be a positive number.");
    err.code = "INVALID_PAYMENT_AMOUNT";
    throw err;
  }
  if (due <= 0) {
    const err = new Error("This invoice is already fully paid. No outstanding balance remains.");
    err.code = "INVOICE_FULLY_PAID";
    throw err;
  }
  if (amount > due) {
    const err = new Error(
      `Payment of ৳${amount.toLocaleString()} exceeds the outstanding due of ৳${due.toLocaleString()}.`
    );
    err.code = "PAYMENT_EXCEEDS_DUE";
    throw err;
  }

  const next = applyPayment({ totalAmountBDT: total, paidAmountBDT: paid, dueAmountBDT: due, amountBDT: amount });

  const paymentEntry = {
    amountBDT: amount,
    paymentMethod: String(paymentMethod || "").trim() || existing.paymentMethod || "N/A",
    date: String(date || "").trim() || new Date().toISOString().split("T")[0],
    transactionId: String(transactionId || "").trim() || `PAY-${Date.now().toString().slice(-8)}`,
    note: String(note || "").trim(),
    screenshot: String(screenshot || "").trim() || "",
    actor: actor || null,
    at: new Date().toISOString(),
  };

  await invoicesCollection.updateOne(
    { invoiceNo },
    {
      $set: {
        paidAmountBDT: next.paidAmountBDT,
        dueAmountBDT: next.dueAmountBDT,
        paymentStatus: next.paymentStatus,
        paymentMethod: paymentEntry.paymentMethod,
        approvalStatus: "Pending",
        updatedAt: new Date(),
      },
      $push: {
        payments: paymentEntry,
        auditLog: auditEntry("payment_received", next.paymentStatus, {
          actor,
          reason: `Payment of ৳${amount.toLocaleString()} received${paymentEntry.paymentMethod !== "N/A" ? ` via ${paymentEntry.paymentMethod}` : ""}.${note ? ` ${note}` : ""}. Approval reset to Pending.`,
        }),
      },
    }
  );

  if (existing.customerId) {
    await applyCustomerCredit(existing.customerId, amount, 0);
  }

  const updated = await invoicesCollection.findOne({ invoiceNo });
  logger.info(`recordInvoicePayment: ৳${amount} recorded against ${invoiceNo} (${next.paymentStatus}).`);
  return mapInvoice(updated);
}

/**
 * Shared audit transition: moves an invoice's approvalStatus to the target
 * state, applies any extra field changes, and appends an audit log entry.
 */
async function applyAuditTransition(invoiceNo, { action, status, reason = "", actor = null, set = {}, push = {} }) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.updateOne(
    { invoiceNo },
    {
      $set: { approvalStatus: status, updatedAt: new Date(), ...set },
      $push: { auditLog: auditEntry(action, status, { reason, actor }), ...push },
    }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

export async function approveInvoice(invoiceNo, { actor = null } = {}) {
  return applyAuditTransition(invoiceNo, {
    action: "approved",
    status: "Approved",
    actor,
    set: { paymentStatus: "Paid", dueAmountBDT: 0 },
  });
}

export async function rejectInvoice(invoiceNo, { reason = "", actor = null } = {}) {
  return applyAuditTransition(invoiceNo, {
    action: "rejected",
    status: "Waiting For Feedback",
    reason,
    actor,
    set: { paymentStatus: "Due" },
  });
}

export async function submitFeedback(invoiceNo, { feedback = "", screenshot = "", actor = null } = {}) {
  const push = {};
  if (screenshot) {
    push.screenshots = {
      url: String(screenshot).trim(),
      source: "feedback",
      actor: actor || null,
      at: new Date().toISOString(),
    };
  }
  return applyAuditTransition(invoiceNo, {
    action: "feedback_submitted",
    status: "Final Approval Review",
    reason: feedback,
    actor,
    push,
  });
}

export async function finalApproveInvoice(invoiceNo, { actor = null } = {}) {
  return applyAuditTransition(invoiceNo, {
    action: "final_approved",
    status: "Approved",
    actor,
    set: { paymentStatus: "Paid", dueAmountBDT: 0 },
  });
}

export async function finalRejectInvoice(invoiceNo, { reason = "", actor = null } = {}) {
  return applyAuditTransition(invoiceNo, {
    action: "final_rejected",
    status: "Finally Rejected",
    reason,
    actor,
    set: { paymentStatus: "Due" },
  });
}

export async function syncTopupStatus(invoiceNo, status, { actor = null } = {}) {
  const invoicesCollection = await getCollection("invoices");
  const existing = await invoicesCollection.findOne({ invoiceNo });
  if (!existing) return null;

  await invoicesCollection.updateOne(
    { invoiceNo },
    {
      $set: { topupStatus: String(status || "Pending"), updatedAt: new Date() },
      $push: { auditLog: auditEntry("status_synced", String(status || "Pending"), { actor }) },
    }
  );
  const updated = await invoicesCollection.findOne({ invoiceNo });
  return mapInvoice(updated);
}

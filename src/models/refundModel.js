import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_REFUNDS } from "@/data/seedData";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitize(input = {}) {
  const date = input.date ? String(input.date).trim() : "";
  const groupId = String(input.groupId || "").trim();
  const adAccountName = String(input.adAccountName || "").trim();
  const adAccountId = String(input.adAccountId || "").trim();
  const dollarRate = toNumber(input.dollarRate);
  const remainingDollar = toNumber(input.remainingDollar);
  const paymentMethod = String(input.paymentMethod || "").trim();
  const note = String(input.note || "").trim();
  const totalAmountBDT = round2(dollarRate * remainingDollar);
  return {
    date,
    groupId,
    adAccountName,
    adAccountId,
    dollarRate: round2(dollarRate),
    remainingDollar: round2(remainingDollar),
    totalAmountBDT,
    paymentMethod,
    note,
  };
}

export async function seedRefunds() {
  const collection = await getCollection("refunds");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_REFUNDS.map((r) => {
    const s = sanitize(r);
    return {
      ...s,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
  if (docs.length > 0) await collection.insertMany(docs);
  logger.info(`seedRefunds: seeded ${docs.length} refund records.`);
  return { seeded: docs.length };
}

export async function listRefunds({ search = "" } = {}) {
  await seedRefunds();
  const collection = await getCollection("refunds");
  const filter = {};
  if (search) {
    const q = search.toLowerCase();
    filter.$or = [
      { groupId: { $regex: q, $options: "i" } },
      { adAccountName: { $regex: q, $options: "i" } },
      { adAccountId: { $regex: q, $options: "i" } },
      { paymentMethod: { $regex: q, $options: "i" } },
      { note: { $regex: q, $options: "i" } },
    ];
  }
  const items = await collection.find(filter).sort({ date: -1, createdAt: -1 }).toArray();
  return items.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }));
}

export async function getRefundById(id) {
  await seedRefunds();
  const collection = await getCollection("refunds");
  let doc = null;
  try {
    const { ObjectId } = await import("mongodb");
    doc = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    doc = null;
  }
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function createRefund(data) {
  const collection = await getCollection("refunds");
  const s = sanitize(data);
  if (!s.date) s.date = new Date().toISOString().slice(0, 10);
  if (!s.groupId) throw new Error("GROUP_ID_REQUIRED");
  if (!s.adAccountName) throw new Error("AD_ACCOUNT_NAME_REQUIRED");
  if (!s.adAccountId) throw new Error("AD_ACCOUNT_ID_REQUIRED");
  if (!(s.dollarRate > 0)) throw new Error("DOLLAR_RATE_INVALID");
  if (!s.paymentMethod) throw new Error("PAYMENT_METHOD_REQUIRED");
  if (!s.note) throw new Error("NOTE_REQUIRED");

  const doc = { ...s, createdAt: new Date(), updatedAt: new Date() };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function updateRefund(id, data) {
  const collection = await getCollection("refunds");
  let existing;
  try {
    const { ObjectId } = await import("mongodb");
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;

  const s = sanitize({ ...existing, ...data });
  const patch = {
    date: s.date,
    groupId: s.groupId,
    adAccountName: s.adAccountName,
    adAccountId: s.adAccountId,
    dollarRate: s.dollarRate,
    remainingDollar: s.remainingDollar,
    totalAmountBDT: s.totalAmountBDT,
    paymentMethod: s.paymentMethod,
    note: s.note,
    updatedAt: new Date(),
  };

  await collection.updateOne({ _id: existing._id }, { $set: patch });
  const updated = await collection.findOne({ _id: existing._id });
  const { _id, ...rest } = updated;
  return { ...rest, id: _id.toString() };
}

export async function deleteRefund(id) {
  const collection = await getCollection("refunds");
  let existing;
  try {
    const { ObjectId } = await import("mongodb");
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;
  await collection.deleteOne({ _id: existing._id });
  const { _id, ...rest } = existing;
  return { ...rest, id: _id.toString() };
}

/**
 * Aggregate refund totals from the stored refund collection.
 * Returns lifetime refund total and the current-month refund total with the
 * human-readable month name for the "This Month" summary card.
 */
export async function getRefundSummary() {
  await seedRefunds();
  const collection = await getCollection("refunds");
  const all = await collection.find({}).toArray();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const thisMonthName = now.toLocaleString("en-US", { month: "long" });

  let lifetimeRefund = 0;
  let thisMonthRefund = 0;

  all.forEach((r) => {
    const amount = Number(r.totalAmountBDT) || 0;
    lifetimeRefund += amount;
    let d = null;
    if (r.date) {
      const parsed = new Date(r.date);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
    if (!d && r.createdAt) {
      const parsed = new Date(r.createdAt);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
    if (d && d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
      thisMonthRefund += amount;
    }
  });

  return {
    lifetimeRefund: round2(lifetimeRefund),
    thisMonthRefund: round2(thisMonthRefund),
    thisMonthName,
    thisMonthLabel: `${thisMonthName} ${currentYear}`,
  };
}

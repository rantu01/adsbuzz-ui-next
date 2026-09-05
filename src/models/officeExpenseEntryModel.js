import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_OFFICE_EXPENSE_ENTRIES } from "@/data/seedData";
import { listOfficeExpenses } from "@/models/officeExpenseModel";
import { listOfficeExpenseMonths } from "@/models/officeExpenseMonthModel";
import {
  deductForExpense,
  adjustForExpenseUpdate,
  refundForExpenseDelete,
} from "@/models/officeExpenseFundModel";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitize(input = {}) {
  const month = String(input.month || "").trim();
  const voucherNo = String(input.voucherNo || "").trim();
  const category = String(input.category || "").trim();
  const subCategory = String(input.subCategory || "").trim();
  const description = String(input.description || "").trim();
  const amount = toNumber(input.amount);
  let date = null;
  if (input.date) {
    const parsed = new Date(input.date);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  return { month, voucherNo, category, subCategory, description, amount, date };
}

export async function seedOfficeExpenseEntries() {
  const collection = await getCollection("officeExpenseEntries");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_OFFICE_EXPENSE_ENTRIES.map((e) => {
    const s = sanitize(e);
    return {
      ...s,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  });
  if (docs.length > 0) await collection.insertMany(docs);
  logger.info(`seedOfficeExpenseEntries: seeded ${docs.length} office expense entries.`);
  return { seeded: docs.length };
}

export async function listOfficeExpenseEntries({ month = "", category = "", search = "" } = {}) {
  await seedOfficeExpenseEntries();
  const collection = await getCollection("officeExpenseEntries");
  const filter = {};
  if (month) filter.month = month;
  if (category) filter.category = category;
  if (search) {
    const q = search.toLowerCase();
    filter.$or = [
      { voucherNo: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { subCategory: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  const items = await collection.find(filter).sort({ date: -1, voucherNo: 1 }).toArray();
  return items.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }));
}

export async function getOfficeExpenseEntryById(id) {
  await seedOfficeExpenseEntries();
  const collection = await getCollection("officeExpenseEntries");
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

export async function createOfficeExpenseEntry(data) {
  const collection = await getCollection("officeExpenseEntries");
  const s = sanitize(data);
  if (!s.month) throw new Error("MONTH_REQUIRED");
  if (!s.category) throw new Error("CATEGORY_REQUIRED");

  const doc = { ...s, createdAt: new Date(), updatedAt: new Date() };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  const entry = { ...rest, id: _id.toString() };

  // Every recorded expense is deducted from the persistent office-expense
  // fund balance. If funds are insufficient the entry is rolled back so no
  // un-funded expense can ever be recorded.
  try {
    await deductForExpense({
      amount: s.amount,
      entryId: entry.id,
      month: s.month,
      voucherNo: s.voucherNo,
      note: s.description,
    });
  } catch (err) {
    await collection.deleteOne({ _id });
    throw err;
  }
  return entry;
}

export async function updateOfficeExpenseEntry(id, data) {
  const collection = await getCollection("officeExpenseEntries");
  let existing;
  try {
    const { ObjectId } = await import("mongodb");
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;

  const s = sanitize(data);
  const patch = { updatedAt: new Date() };
  if (s.month) patch.month = s.month;
  if (typeof s.voucherNo === "string") patch.voucherNo = s.voucherNo;
  if (s.category) patch.category = s.category;
  if (typeof s.subCategory === "string") patch.subCategory = s.subCategory;
  if (typeof s.description === "string") patch.description = s.description;
  if (data.amount !== undefined) patch.amount = s.amount;
  if ("date" in data) patch.date = s.date;

  const oldAmount = Number(existing.amount) || 0;
  const newAmount = data.amount !== undefined ? s.amount : oldAmount;
  const newMonth = s.month || existing.month;
  const newVoucher = typeof s.voucherNo === "string" ? s.voucherNo : existing.voucherNo;
  const delta = Math.round((newAmount - oldAmount) * 100) / 100;

  await collection.updateOne({ _id: existing._id }, { $set: patch });

  // Keep the fund balance in sync with the new amount. A positive delta is
  // balance-checked; if funds are insufficient the entry is rolled back to
  // its previous values so the recorded expense never exceeds the balance.
  if (delta !== 0) {
    try {
      await adjustForExpenseUpdate({
        entryId: existing._id.toString(),
        month: newMonth,
        voucherNo: newVoucher,
        oldAmount,
        newAmount,
      });
    } catch (err) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            month: existing.month,
            voucherNo: existing.voucherNo,
            category: existing.category,
            subCategory: existing.subCategory,
            description: existing.description,
            amount: existing.amount,
            date: existing.date,
            updatedAt: new Date(),
          },
        },
      );
      throw err;
    }
  }

  const updated = await collection.findOne({ _id: existing._id });
  const { _id, ...rest } = updated;
  return { ...rest, id: _id.toString() };
}

export async function deleteOfficeExpenseEntry(id) {
  const collection = await getCollection("officeExpenseEntries");
  let existing;
  try {
    const { ObjectId } = await import("mongodb");
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;
  await collection.deleteOne({ _id: existing._id });
  // Refund the removed expense back to the available fund balance.
  await refundForExpenseDelete({
    entryId: existing._id.toString(),
    month: existing.month,
    voucherNo: existing.voucherNo,
    amount: Number(existing.amount) || 0,
  });
  const { _id, ...rest } = existing;
  return { ...rest, id: _id.toString() };
}

/**
 * Aggregate office-expense data for the dashboard, computed from the stored
 * entry + month collections (mirrors the AdsBuzz LLC Accounts Dashboard CSV).
 */
export async function getOfficeExpenseDashboard(year) {
  await seedOfficeExpenseEntries();

  const collection = await getCollection("officeExpenseEntries");
  const allEntries = await collection.find({}).toArray();

  const years = [...new Set(allEntries.map((e) => String(e.month || "").slice(0, 4)))].filter(Boolean).sort();

  const targetYear = year && years.includes(String(year)) ? String(year) : years[years.length - 1];
  const entries = targetYear ? allEntries.filter((e) => String(e.month || "").startsWith(targetYear)) : [];

  const months = [...new Set(entries.map((e) => e.month))].sort();

  const categoriesDoc = await listOfficeExpenses();
  const categories = (categoriesDoc || []).map((c) => c.mainCategory);

  const matrix = {};
  const monthTotals = {};
  const categoryTotals = {};
  categories.forEach((c) => {
    matrix[c] = {};
    months.forEach((m) => (matrix[c][m] = 0));
    categoryTotals[c] = 0;
  });
  months.forEach((m) => (monthTotals[m] = 0));

  entries.forEach((e) => {
    const cat = e.category;
    const m = e.month;
    const amt = Number(e.amount) || 0;
    if (!(cat in matrix)) {
      matrix[cat] = {};
      months.forEach((mm) => (matrix[cat][mm] = 0));
      categoryTotals[cat] = 0;
    }
    if (!(m in matrix[cat])) matrix[cat][m] = 0;
    matrix[cat][m] += amt;
    monthTotals[m] = (monthTotals[m] || 0) + amt;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const yearTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0);

  const monthsMeta = await listOfficeExpenseMonths();
  const cashInHand = {};
  monthsMeta.forEach((meta) => {
    if (months.includes(meta.month)) cashInHand[meta.month] = meta.cashInHand || 0;
  });

  return {
    year: targetYear || null,
    years,
    months,
    categories,
    matrix,
    monthTotals,
    categoryTotals,
    yearTotal,
    cashInHand,
    totalEntries: entries.length,
  };
}

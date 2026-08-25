import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_OFFICE_EXPENSE_MONTHS } from "@/data/seedData";

function sanitize(input = {}) {
  const month = String(input.month || "").trim();
  const preparedBy = String(input.preparedBy || "").trim();
  const cashInHand = Number(input.cashInHand);
  return {
    month,
    preparedBy,
    cashInHand: Number.isFinite(cashInHand) && cashInHand >= 0 ? cashInHand : 0,
  };
}

export async function seedOfficeExpenseMonths() {
  const collection = await getCollection("officeExpenseMonths");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_OFFICE_EXPENSE_MONTHS.map((m) => ({
    ...sanitize(m),
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  if (docs.length > 0) await collection.insertMany(docs);
  logger.info(`seedOfficeExpenseMonths: seeded ${docs.length} office expense months.`);
  return { seeded: docs.length };
}

export async function listOfficeExpenseMonths() {
  await seedOfficeExpenseMonths();
  const collection = await getCollection("officeExpenseMonths");
  const items = await collection.find({}).sort({ month: 1 }).toArray();
  return items.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }));
}

export async function getOfficeExpenseMonthByCode(month) {
  await seedOfficeExpenseMonths();
  const collection = await getCollection("officeExpenseMonths");
  const doc = await collection.findOne({ month });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function createOfficeExpenseMonth(data) {
  const collection = await getCollection("officeExpenseMonths");
  const s = sanitize(data);
  if (!s.month) throw new Error("MONTH_REQUIRED");

  const existing = await collection.findOne({ month: s.month });
  if (existing) throw new Error("DUPLICATE");

  const doc = { ...s, createdAt: new Date(), updatedAt: new Date() };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function updateOfficeExpenseMonth(month, data) {
  const collection = await getCollection("officeExpenseMonths");
  const existing = await collection.findOne({ month });
  if (!existing) return null;

  const patch = {};
  if (typeof data.preparedBy === "string") patch.preparedBy = data.preparedBy.trim();
  if (data.cashInHand !== undefined) {
    const cash = Number(data.cashInHand);
    patch.cashInHand = Number.isFinite(cash) && cash >= 0 ? cash : 0;
  }
  patch.updatedAt = new Date();

  await collection.updateOne({ month }, { $set: patch });
  const updated = await collection.findOne({ month });
  const { _id, ...rest } = updated;
  return { ...rest, id: _id.toString() };
}

export async function deleteOfficeExpenseMonth(month) {
  const collection = await getCollection("officeExpenseMonths");
  const existing = await collection.findOne({ month });
  if (!existing) return null;
  await collection.deleteOne({ month });
  const { _id, ...rest } = existing;
  return { ...rest, id: _id.toString() };
}

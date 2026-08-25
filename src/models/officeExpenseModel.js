import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_OFFICE_EXPENSES } from "@/data/seedData";

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sanitize(input = {}) {
  const mainCategory = String(input.mainCategory || "").trim();
  let subCategories = [];
  if (Array.isArray(input.subCategories)) {
    subCategories = input.subCategories.map((s) => String(s || "").trim()).filter(Boolean);
  } else if (typeof input.subCategories === "string") {
    subCategories = input.subCategories
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const order = typeof input.order === "number" && Number.isFinite(input.order) ? input.order : undefined;
  return { mainCategory, subCategories, order };
}

export async function seedOfficeExpenses() {
  const collection = await getCollection("officeExpenseCategories");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_OFFICE_EXPENSES.map((c, i) => ({
    mainCategory: String(c.mainCategory || "").trim(),
    subCategories: Array.isArray(c.subCategories)
      ? c.subCategories.map((s) => String(s).trim()).filter(Boolean)
      : [],
    order: i + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));

  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  logger.info(`seedOfficeExpenses: seeded ${docs.length} office expense categories.`);
  return { seeded: docs.length };
}

export async function listOfficeExpenses({ search = "" } = {}) {
  await seedOfficeExpenses();
  const collection = await getCollection("officeExpenseCategories");
  const cursor = collection.find({}).sort({ order: 1, mainCategory: 1 });
  const items = await cursor.toArray();

  let result = items;
  if (search) {
    const q = search.toLowerCase();
    result = items.filter(
      (c) =>
        c.mainCategory?.toLowerCase().includes(q) ||
        (c.subCategories || []).some((s) => s.toLowerCase().includes(q)),
    );
  }
  return result.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }));
}

export async function getOfficeExpenseById(id) {
  await seedOfficeExpenses();
  const collection = await getCollection("officeExpenseCategories");
  let doc = null;
  try {
    doc = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    doc = null;
  }
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function createOfficeExpense(data) {
  const collection = await getCollection("officeExpenseCategories");
  const s = sanitize(data);
  if (!s.mainCategory) {
    throw new Error("MAIN_CATEGORY_REQUIRED");
  }

  const existing = await collection.findOne({
    mainCategory: { $regex: `^${escapeRegex(s.mainCategory)}$`, $options: "i" },
  });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const count = await collection.countDocuments();
  const doc = {
    mainCategory: s.mainCategory,
    subCategories: s.subCategories,
    order: typeof s.order === "number" ? s.order : count + 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  return { ...rest, id: _id.toString() };
}

export async function updateOfficeExpense(id, data) {
  const collection = await getCollection("officeExpenseCategories");
  let existing;
  try {
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;

  const s = sanitize(data);
  const patch = { updatedAt: new Date() };

  if (s.mainCategory) {
    const duplicate = await collection.findOne({
      mainCategory: { $regex: `^${escapeRegex(s.mainCategory)}$`, $options: "i" },
      _id: { $ne: new ObjectId(id) },
    });
    if (duplicate) throw new Error("DUPLICATE");
    patch.mainCategory = s.mainCategory;
  }

  if (Array.isArray(data.subCategories) || typeof data.subCategories === "string") {
    patch.subCategories = s.subCategories;
  }
  if (typeof s.order === "number") {
    patch.order = s.order;
  }

  await collection.updateOne({ _id: new ObjectId(id) }, { $set: patch });
  const updated = await collection.findOne({ _id: new ObjectId(id) });
  const { _id, ...rest } = updated;
  return { ...rest, id: _id.toString() };
}

export async function deleteOfficeExpense(id) {
  const collection = await getCollection("officeExpenseCategories");
  let existing;
  try {
    existing = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    existing = null;
  }
  if (!existing) return null;

  await collection.deleteOne({ _id: new ObjectId(id) });
  const { _id, ...rest } = existing;
  return { ...rest, id: _id.toString() };
}

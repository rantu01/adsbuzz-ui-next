import { getDb, getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { syncLegacyInvoices } from "@/models/invoiceModel";

export const CUSTOMER_STATUS = ["Active", "Inactive", "Lost"];
const DEFAULT_DOLLAR_RATE = 132;

function toDateString(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split("T")[0];
}

function initials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function mapAccountStatus(accountStatus) {
  if (accountStatus === "frozen") return "Inactive";
  return "Active";
}

function slugify(value, fallback = "") {
  const slug = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function mapUserToCustomer(user) {
  const rate = Number(user.dollarRate) > 0 ? Number(user.dollarRate) : DEFAULT_DOLLAR_RATE;
  const balanceUSD = Number(user.availableBalance || 0);
  return {
    id: user.customId || `CUST-${user.numericId || "0000"}`,
    uid: user.uid || null,
    name: user.displayName || user.email || "Unnamed Customer",
    email: user.email || "",
    phone: user.phoneNumber || "",
    companyName: user.companyName || "",
    status: mapAccountStatus(user.accountStatus),
    createdAt: toDateString(user.createdAt),
    balanceBDT: balanceUSD * rate,
    balanceUSD,
    creditLimitUSD: Number(user.creditLimitUSD || 0),
    groupId: user.groupName || "",
    notes: user.notes || "",
    avatar: user.avatar || initials(user.displayName) || "",
    favorite: Boolean(user.favorite),
    role: user.role || "customer",
  };
}

async function getNextCustomerId() {
  const db = await getDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: "customerId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  const counter = result.value || result;
  return `CUST-${String(counter.seq).padStart(4, "0")}`;
}

export async function syncCustomersFromUsers() {
  try {
    const db = await getDb();
    const users = await db
      .collection("users")
      .find({ role: "customer" })
      .project({ password: 0 })
      .toArray();

    const customersCollection = db.collection("customers");
    let inserted = 0;
    let updated = 0;

    for (const user of users) {
      const base = mapUserToCustomer(user);
      const result = await customersCollection.updateOne(
        { id: base.id },
        {
          $set: {
            uid: base.uid,
            name: base.name,
            email: base.email,
            phone: base.phone,
            groupId: base.groupId,
            role: base.role,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            companyName: "",
            status: base.status,
            createdAt: base.createdAt,
            balanceBDT: base.balanceBDT,
            balanceUSD: base.balanceUSD,
            creditLimitUSD: base.creditLimitUSD,
            notes: "",
            avatar: base.avatar,
            favorite: false,
          },
        },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted += 1;
      else updated += 1;
    }

    logger.info(`syncCustomersFromUsers: ${inserted} inserted, ${updated} updated.`);
    return { inserted, updated };
  } catch (error) {
    logger.error("syncCustomersFromUsers failed.", error);
    throw error;
  }
}

export async function listCustomers({ search = "", status = "", favorite = "" } = {}) {
  await syncCustomersFromUsers();
  await syncLegacyInvoices();
  const collection = await getCollection("customers");

  const filter = {};
  if (status && status !== "All") filter.status = status;
  if (favorite === "true") filter.favorite = true;

  let cursor = collection.find(filter).sort({ createdAt: 1, name: 1 });
  const customers = await cursor.toArray();

  let items = customers;
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.groupId?.toLowerCase().includes(q)
    );
  }

  return items;
}

export async function getCustomerById(id) {
  if (!id) return null;
  const collection = await getCollection("customers");
  let customer = await collection.findOne({ id });
  if (customer) {
    await syncLegacyInvoices();
    return collection.findOne({ id });
  }
  await syncCustomersFromUsers();
  await syncLegacyInvoices();
  return collection.findOne({ id });
}

export async function createCustomer(data = {}) {
  const collection = await getCollection("customers");
  const id = await getNextCustomerId();

  const generatedGroupId =
    data.groupId?.trim() ||
    (data.name ? `GC-${slugify(data.name, data.name.slice(0, 6))}` : "GC-GENERIC");

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();

  const customer = {
    id,
    uid: null,
    name,
    email,
    phone: String(data.phone || "").trim(),
    companyName: String(data.companyName || "").trim(),
    status: CUSTOMER_STATUS.includes(data.status) ? data.status : "Active",
    createdAt: toDateString(new Date()),
    balanceBDT: 0,
    balanceUSD: 0,
    creditLimitUSD: Number(data.creditLimitUSD) > 0 ? Number(data.creditLimitUSD) : 0,
    groupId: generatedGroupId,
    notes: "",
    avatar: initials(name) || "",
    favorite: false,
    role: "customer",
    createdAtRaw: new Date(),
    updatedAt: new Date(),
  };

  await collection.insertOne(customer);
  logger.info(`createCustomer: created ${customer.id}`);
  return customer;
}

const EDITABLE_FIELDS = [
  "name",
  "groupId",
  "companyName",
  "email",
  "phone",
  "creditLimitUSD",
  "status",
  "notes",
  "avatar",
];

export async function updateCustomer(id, data = {}) {
  if (!id) return null;
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const update = { updatedAt: new Date() };
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined) {
      if (field === "status" && !CUSTOMER_STATUS.includes(data.status)) continue;
      update[field] = field === "creditLimitUSD" ? Number(data[field]) || 0 : data[field];
    }
  }

  await collection.updateOne({ id }, { $set: update });
  return collection.findOne({ id });
}

export async function updateCustomerNotes(id, notes) {
  if (!id) return null;
  const collection = await getCollection("customers");
  await collection.updateOne(
    { id },
    { $set: { notes: String(notes || ""), updatedAt: new Date() } }
  );
  return collection.findOne({ id });
}

export async function toggleCustomerFavorite(id) {
  if (!id) return null;
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const next = !Boolean(existing.favorite);
  await collection.updateOne(
    { id },
    { $set: { favorite: next, updatedAt: new Date() } }
  );
  return collection.findOne({ id });
}

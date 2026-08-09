import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_VENDORS } from "@/data/seedData";
import { VENDOR_TYPES } from "@/constants/vendorTypes";

const VENDOR_STATUS = [
  "Active",
  "Available",
  "Sold",
  "Disable",
  "Inactive",
  "Need Support",
];

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isPositiveFinite(value) {
  return Number(value) > 0 && Number.isFinite(Number(value));
}

function normalizePayment(entry) {
  const amount = isPositiveFinite(entry.amountUSD) ? round2(entry.amountUSD) : 0;
  return {
    date: String(entry.date || "").slice(0, 10),
    amountUSD: amount,
    paymentMethod: String(entry.paymentMethod || "").trim(),
    transactionId: String(entry.transactionId || "").trim(),
  };
}

function sanitize(input = {}) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const vendorType = VENDOR_TYPES.includes(input.vendorType) ? input.vendorType : "Others";
  const status = VENDOR_STATUS.includes(input.status) ? input.status : "Active";
  const email = String(input.email || "").trim();
  const phone = String(input.phone || "").trim();
  const outstandingBalanceUSD = Number.isFinite(Number(input.outstandingBalanceUSD))
    ? Math.max(0, Number(input.outstandingBalanceUSD))
    : 0;
  const paymentHistory = Array.isArray(input.paymentHistory)
    ? input.paymentHistory.map(normalizePayment)
    : [];

  return { id, name, vendorType, status, email, phone, outstandingBalanceUSD, paymentHistory };
}

export async function seedVendors() {
  const collection = await getCollection("vendors");
  await collection.createIndex({ id: 1 }, { unique: true });

  let seeded = 0;
  for (const v of INITIAL_VENDORS) {
    const doc = {
      ...sanitize(v),
      updatedAt: new Date(),
    };
    const result = await collection.updateOne(
      { id: doc.id },
      { $setOnInsert: doc },
      { upsert: true }
    );
    if (result.upsertedCount > 0) seeded += 1;
  }
  logger.info(`seedVendors: seeded ${seeded} vendors.`);
  return { seeded };
}

function mapVendor({ _id, ...rest }) {
  return { ...rest };
}

export async function listVendors({ search = "" } = {}) {
  await seedVendors();
  const collection = await getCollection("vendors");
  const items = await collection.find({}).sort({ name: 1 }).toArray();

  let result = items;
  if (search) {
    const q = search.toLowerCase();
    result = items.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) ||
        v.id?.toLowerCase().includes(q) ||
        v.vendorType?.toLowerCase().includes(q)
    );
  }
  return result.map(mapVendor);
}

export async function getVendorById(id) {
  await seedVendors();
  const collection = await getCollection("vendors");
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return { ...mapVendor(doc), _id: doc._id };
}

export async function createVendor(data) {
  const collection = await getCollection("vendors");
  let vendor = sanitize(data);

  if (!vendor.id) {
    vendor.id = `VEND-${Date.now()}`;
  }

  const existing = await collection.findOne({ id: vendor.id });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const doc = { ...vendor, updatedAt: new Date() };
  const result = await collection.insertOne(doc);
  return { ...mapVendor(doc), _id: result.insertedId };
}

export async function updateVendor(id, data) {
  const collection = await getCollection("vendors");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const allowed = [
    "name",
    "vendorType",
    "status",
    "email",
    "phone",
    "outstandingBalanceUSD",
    "paymentHistory",
  ];
  const patch = {};
  for (const key of allowed) {
    if (!(key in data)) continue;
    const value = data[key];
    if (key === "vendorType") patch.vendorType = VENDOR_TYPES.includes(value) ? value : existing.vendorType;
    else if (key === "status") patch.status = VENDOR_STATUS.includes(value) ? value : existing.status;
    else if (key === "outstandingBalanceUSD") patch.outstandingBalanceUSD = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : existing.outstandingBalanceUSD;
    else if (key === "paymentHistory") patch.paymentHistory = Array.isArray(value) ? value.map(normalizePayment) : existing.paymentHistory;
    else patch[key] = String(value || value === "" ? value : "").trim();
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ id }, { $set: patch });
  const updated = await collection.findOne({ id });
  return { ...mapVendor(updated), _id: updated._id };
}

export async function recordVendorPayment(id, { amountUSD, paymentMethod, date, transactionId } = {}) {
  const collection = await getCollection("vendors");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const amount = isPositiveFinite(amountUSD) ? round2(amountUSD) : 0;
  const entry = {
    date: String(date || new Date().toISOString().slice(0, 10)),
    amountUSD: amount,
    paymentMethod: String(paymentMethod || "Wire Transfer").trim(),
    transactionId: String(transactionId || "").trim() || `PAY-${Date.now().toString().slice(-6)}`,
  };

  const nextBalance = Math.max(0, Number(existing.outstandingBalanceUSD || 0) - amount);
  const result = await collection.findOneAndUpdate(
    { id },
    {
      $push: { paymentHistory: entry },
      $set: { outstandingBalanceUSD: nextBalance, updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) return null;
  return { ...mapVendor(doc), _id: doc._id };
}

export async function deleteVendor(id) {
  if (!id) return null;
  const collection = await getCollection("vendors");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  await collection.deleteOne({ id });
  return { ...mapVendor(existing), _id: existing._id };
}
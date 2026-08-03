import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_SETTINGS } from "@/data/seedData";

const APP_DOC_ID = "app";

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function sanitize(input = {}) {
  const companyName = String(input.companyName || INITIAL_SETTINGS.companyName || "").trim();
  const defaultDollarRate = Number(input.defaultDollarRate) > 0 ? Number(input.defaultDollarRate) : Number(INITIAL_SETTINGS.defaultDollarRate) || 132;
  const paymentMethods = Array.isArray(input.paymentMethods)
    ? [...new Set(input.paymentMethods.map((pm) => String(pm).trim()).filter(Boolean))]
    : [];
  return { companyName, defaultDollarRate: round2(defaultDollarRate), paymentMethods };
}

export async function getSettings() {
  const collection = await getCollection("settings");

  const existing = await collection.findOne({ _id: APP_DOC_ID });
  if (existing) {
    const { _id, ...rest } = existing;
    return rest;
  }

  const doc = {
    _id: APP_DOC_ID,
    ...sanitize(INITIAL_SETTINGS),
    roles: INITIAL_SETTINGS.roles,
    permissions: INITIAL_SETTINGS.permissions,
    updatedAt: new Date(),
  };
  await collection.updateOne({ _id: APP_DOC_ID }, { $setOnInsert: doc }, { upsert: true });
  const { _id, ...rest } = doc;
  logger.info("getSettings: seeded default settings.");
  return rest;
}

export async function updateSettings(data = {}) {
  const collection = await getCollection("settings");
  const current = await getSettings();

  const patch = { updatedAt: new Date() };
  if (data.companyName !== undefined) patch.companyName = String(data.companyName || "").trim();
  if (data.defaultDollarRate !== undefined) {
    const rate = Number(data.defaultDollarRate);
    patch.defaultDollarRate = rate > 0 ? round2(rate) : current.defaultDollarRate;
  }
  if (Array.isArray(data.paymentMethods)) {
    patch.paymentMethods = [...new Set(data.paymentMethods.map((pm) => String(pm).trim()).filter(Boolean))];
  }
  if (data.roles !== undefined && Array.isArray(data.roles)) patch.roles = data.roles;
  if (data.permissions !== undefined && data.permissions && typeof data.permissions === "object") {
    patch.permissions = data.permissions;
  }

  await collection.updateOne({ _id: APP_DOC_ID }, { $set: patch }, { upsert: true });
  return getSettings();
}

export async function updateBaseRate(rate) {
  const collection = await getCollection("settings");
  const value = Number(rate);
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error("INVALID_RATE");
  }
  await collection.updateOne(
    { _id: APP_DOC_ID },
    { $set: { defaultDollarRate: round2(value), updatedAt: new Date() } },
    { upsert: true }
  );
  return getSettings();
}

export async function addPaymentMethod(name) {
  const collection = await getCollection("settings");
  const value = String(name || "").trim();
  if (!value) {
    throw new Error("INVALID_NAME");
  }

  const current = await getSettings();
  const paymentMethods = current.paymentMethods.includes(value)
    ? current.paymentMethods
    : [...current.paymentMethods, value];

  await collection.updateOne(
    { _id: APP_DOC_ID },
    { $set: { paymentMethods, updatedAt: new Date() } },
    { upsert: true }
  );
  return getSettings();
}

export async function removePaymentMethod(name) {
  const collection = await getCollection("settings");
  const value = String(name || "").trim();

  const current = await getSettings();
  const paymentMethods = current.paymentMethods.filter((pm) => pm !== value);

  await collection.updateOne(
    { _id: APP_DOC_ID },
    { $set: { paymentMethods, updatedAt: new Date() } },
    { upsert: true }
  );
  return getSettings();
}

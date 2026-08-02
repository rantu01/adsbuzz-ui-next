import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";

const DEFAULT_DOLLAR_RATE = 132;
const DEFAULT_GROUP_CODE = "GC-700";
const DEFAULT_OWNER = "ADSBUZZ";

function stripActPrefix(value) {
  if (!value) return "";
  return String(value).replace(/^act_/, "");
}

export function mapStatusToUi(legacyStatus) {
  switch (String(legacyStatus || "").toLowerCase()) {
    case "active":
      return "Active";
    case "paused":
      return "Available";
    default:
      return "Disabled";
  }
}

export function mapStatusToLegacy(uiStatus) {
  switch (String(uiStatus || "").toLowerCase()) {
    case "sold":
    case "active":
      return "active";
    case "available":
      return "paused";
    case "disable":
    case "disabled":
      return "disabled";
    default:
      return "disabled";
  }
}

export function toUiAccount(doc) {
  const legacyId = doc.accountId || doc.metaAccountId || "";
  const rate = Number(doc.dollarRate) > 0 ? Number(doc.dollarRate) : DEFAULT_DOLLAR_RATE;
  const mapped = mapStatusToUi(doc.status);
  const assigned = Boolean(doc.uid) && !doc.unassignedAt;

  return {
    adAccountId: doc.adAccountId || stripActPrefix(legacyId) || String(doc._id),
    adAccountName: doc.adAccountName || doc.name || doc.metaAccountName || "Unnamed Account",
    platform: doc.platform || (legacyId.startsWith("act_") ? "Facebook" : "Facebook"),
    accountType: doc.accountType || "Agency Account",
    dollarRate: rate,
    monthlySpending: Number(doc.spent || doc.budget || 0),
    accountOwner: doc.accountOwner || doc.email || DEFAULT_OWNER,
    userGroupCode: doc.userGroupCode || DEFAULT_GROUP_CODE,
    accountStatus: doc.accountStatus || (assigned ? "Sold" : mapped),
    bmId: doc.bmId || "",
    bmName: doc.bmName || "",
    billingCard: doc.billingCard || "",
    seriesId: doc.seriesId || "",
    assignAdAccount: doc.assignAdAccount || "",
    productType: doc.productType || "",
    fundAccountStatus: doc.fundAccountStatus ?? true,
    assignedCustomer: assigned ? (doc.assignedCustomer || doc.uid || "") : "",
    status: doc.status || (assigned ? "active" : "available"),
    uid: doc.uid || "",
    _id: String(doc._id),
  };
}

export async function getAdAccountUiByIdentifier(identifier) {
  const doc = await getAdAccountByIdentifier(identifier);
  return doc ? toUiAccount(doc) : null;
}

async function getAdAccountByIdentifier(identifier) {
  const collection = await getCollection("adAccounts");
  const striped = stripActPrefix(identifier);
  let doc = null;

  if (/^[a-f0-9]{24}$/i.test(identifier)) {
    doc = await collection.findOne({ _id: new ObjectId(identifier) });
  }
  doc =
    doc ||
    (await collection.findOne({ adAccountId: identifier })) ||
    (await collection.findOne({ adAccountId: striped })) ||
    (await collection.findOne({ accountId: identifier })) ||
    (await collection.findOne({ accountId: striped })) ||
    (await collection.findOne({ metaAccountId: identifier })) ||
    (await collection.findOne({ metaAccountId: striped }));
  return doc;
}

export async function listAdAccounts() {
  const collection = await getCollection("adAccounts");
  const docs = await collection.find({}).sort({ updatedAt: -1 }).limit(500).toArray();
  const accounts = docs.map(toUiAccount).filter(Boolean);
  logger.info(`listAdAccounts: ${accounts.length} accounts returned.`);
  return accounts;
}

export async function createAdAccount(ui) {
  const collection = await getCollection("adAccounts");
  const rawId = String(ui.adAccountId || "").trim();
  const legacyId = rawId ? `act_${stripActPrefix(rawId)}` : "";
  const name = String(ui.adAccountName || "").trim() || `Ad Account ${Date.now()}`;
  const rate = Number(ui.dollarRate) > 0 ? Number(ui.dollarRate) : DEFAULT_DOLLAR_RATE;

  const doc = {
    uid: "",
    email: "",
    name,
    accountId: legacyId || `act_${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    metaAccountId: legacyId || "",
    metaAccountName: name,
    currency: "USD",
    spendCap: Number(ui.monthlySpending) || 0,
    status: mapStatusToLegacy(ui.accountStatus),
    budget: Number(ui.monthlySpending) || 0,
    spent: 0,
    assignedBy: null,
    assignedAt: null,
    unassignedAt: null,
    lastSyncedAt: null,
    syncStatus: "pending",
    syncError: null,
    lastInsights: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    adAccountId: rawId,
    adAccountName: name,
    platform: ui.platform || "Facebook",
    accountType: ui.accountType || "Agency Account",
    dollarRate: rate,
    monthlySpending: Number(ui.monthlySpending) || 0,
    accountOwner: ui.accountOwner || DEFAULT_OWNER,
    userGroupCode: ui.userGroupCode || DEFAULT_GROUP_CODE,
    accountStatus: ui.accountStatus || "Available",
    bmId: ui.bmId || "",
    bmName: ui.bmName || "",
    billingCard: ui.billingCard || ui.selectCard || "",
    seriesId: ui.seriesId || "",
    assignAdAccount: ui.assignAdAccount || "",
    productType: ui.productType || "",
    fundAccountStatus: ui.fundAccountStatus ?? true,
    assignedCustomer: ui.assignedCustomer || "",
  };

  const result = await collection.insertOne(doc);
  const created = await collection.findOne({ _id: result.insertedId });
  logger.info(`createAdAccount: created ${name}`);
  return toUiAccount(created);
}

export async function updateAdAccountById(id, ui) {
  const collection = await getCollection("adAccounts");
  const doc = await getAdAccountByIdentifier(id);
  if (!doc) return null;

  const rate = Number(ui.dollarRate) > 0 ? Number(ui.dollarRate) : Number(doc.dollarRate) || DEFAULT_DOLLAR_RATE;
  const rawId = String(ui.adAccountId || "").trim();
  const legacyId = rawId ? `act_${stripActPrefix(rawId)}` : doc.accountId;

  const update = {
    name: String(ui.adAccountName || "").trim(),
    accountId: legacyId,
    metaAccountId: legacyId,
    spendCap: Number(ui.monthlySpending) || Number(doc.spendCap) || 0,
    budget: Number(ui.monthlySpending) || Number(doc.budget) || 0,
    status: mapStatusToLegacy(ui.accountStatus),
    updatedAt: new Date(),
    adAccountId: rawId,
    adAccountName: String(ui.adAccountName || "").trim(),
    platform: ui.platform,
    accountType: ui.accountType,
    dollarRate: rate,
    monthlySpending: Number(ui.monthlySpending) || 0,
    accountOwner: ui.accountOwner || doc.accountOwner || DEFAULT_OWNER,
    userGroupCode: ui.userGroupCode || doc.userGroupCode || "",
    accountStatus: ui.accountStatus,
    bmId: ui.bmId || "",
    bmName: ui.bmName || "",
    billingCard: ui.billingCard || ui.selectCard || "",
    seriesId: ui.seriesId || "",
    assignAdAccount: ui.assignAdAccount || "",
    productType: ui.productType || "",
    fundAccountStatus: ui.fundAccountStatus ?? true,
    assignedCustomer: ui.assignedCustomer ?? doc.assignedCustomer ?? "",
  };

  await collection.updateOne({ _id: doc._id }, { $set: update });
  const saved = await collection.findOne({ _id: doc._id });
  return toUiAccount(saved);
}

export async function updateAdAccountStatus(id, uiStatus) {
  const collection = await getCollection("adAccounts");
  const doc = await getAdAccountByIdentifier(id);
  if (!doc) return null;

  const update = {
    accountStatus: uiStatus,
    status: mapStatusToLegacy(uiStatus),
    updatedAt: new Date(),
  };
  await collection.updateOne({ _id: doc._id }, { $set: update });
  const saved = await collection.findOne({ _id: doc._id });
  return toUiAccount(saved);
}

export async function bulkUpdateStatus(ids, uiStatus) {
  const collection = await getCollection("adAccounts");
  const resolved = [];
  for (const id of ids) {
    const doc = await getAdAccountByIdentifier(id);
    if (doc) resolved.push(doc._id);
  }
  const result = await collection.updateMany(
    { _id: { $in: resolved } },
    { $set: { accountStatus: uiStatus, status: mapStatusToLegacy(uiStatus), updatedAt: new Date() } }
  );
  return { matched: result.matchedCount, modified: result.modifiedCount };
}
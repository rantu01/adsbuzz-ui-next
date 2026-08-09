import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";

const DEFAULT_DOLLAR_RATE = 132;
const DEFAULT_GROUP_CODE = "GC-700";
const DEFAULT_OWNER = "ADSBUZZ";

function stripActPrefix(value) {
  if (!value) return "";
  return String(value).replace(/^act_/, "");
}

export function toUiAccount(doc) {
  const legacyId = doc.accountId || doc.metaAccountId || "";
  const rate = Number(doc.dollarRate) > 0 ? Number(doc.dollarRate) : DEFAULT_DOLLAR_RATE;

  return {
    adAccountId: doc.adAccountId || stripActPrefix(legacyId) || String(doc._id),
    adAccountName: doc.adAccountName || doc.name || "Unnamed Account",
    platform: doc.platform || "Facebook",
    accountType: doc.accountType || "Agency Account",
    dollarRate: rate,
    monthlySpending: Number(doc.spent || doc.budget || 0),
    accountOwner: doc.accountOwner || DEFAULT_OWNER,
    userGroupCode: doc.userGroupCode || DEFAULT_GROUP_CODE,
    accountStatus: doc.accountStatus || "Available",
    adminId: doc.adminId || "",
    bmId: doc.bmId || "",
    bmName: doc.bmName || "",
    billingCard: doc.billingCard || doc.selectCard || "",
    selectCard: doc.selectCard || doc.billingCard || "",
    seriesId: doc.seriesId || "",
    assignAdAccount: doc.assignAdAccount || "",
    productType: doc.productType || "",
    fundAccountStatus: doc.fundAccountStatus ?? true,
    assignedCustomer: doc.assignedCustomer || "",
    status: doc.status || "available",
    uid: doc.uid || "",
    source: doc.source || "social",
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
    _id: String(doc._id),
  };
}

export async function listSocialAdAccounts() {
  const collection = await getCollection("socialAdAccounts");
  const docs = await collection.find({}).sort({ createdAt: -1 }).toArray();
  const accounts = docs.map(toUiAccount).filter(Boolean);
  logger.info(`listSocialAdAccounts: ${accounts.length} accounts returned.`);
  return accounts;
}

export async function getSocialAdAccountById(identifier) {
  const collection = await getCollection("socialAdAccounts");
  let doc = null;

  if (/^[a-f0-9]{24}$/i.test(identifier)) {
    const { ObjectId } = await import("mongodb");
    doc = await collection.findOne({ _id: new ObjectId(identifier) });
  }
  doc =
    doc ||
    (await collection.findOne({ adAccountId: identifier })) ||
    (await collection.findOne({ _id: String(identifier) }));
  return doc ? toUiAccount(doc) : null;
}

export async function findSocialAdAccountByAdAccountId(adAccountId) {
  const collection = await getCollection("socialAdAccounts");
  const doc = await collection.findOne({ adAccountId });
  return doc ? toUiAccount(doc) : null;
}

export async function createSocialAdAccount(ui) {
  const collection = await getCollection("socialAdAccounts");
  const rawId = String(ui.adAccountId || "").trim();
  const name = String(ui.adAccountName || "").trim() || `Ad Account ${Date.now()}`;
  const rate = Number(ui.dollarRate) > 0 ? Number(ui.dollarRate) : DEFAULT_DOLLAR_RATE;

  const doc = {
    uid: "",
    email: "",
    name,
    accountId: rawId,
    metaAccountId: rawId,
    metaAccountName: name,
    currency: "USD",
    spendCap: Number(ui.monthlySpending) || 0,
    status: "available",
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
    adminId: ui.adminId || "",
    bmId: ui.bmId || "",
    bmName: ui.bmName || "",
    billingCard: ui.billingCard || ui.selectCard || "",
    selectCard: ui.selectCard || ui.billingCard || "",
    seriesId: ui.seriesId || "",
    assignAdAccount: ui.assignAdAccount || "",
    productType: ui.productType || "",
    fundAccountStatus: ui.fundAccountStatus ?? true,
    assignedCustomer: ui.assignedCustomer || "",
    source: "social",
  };

  const result = await collection.insertOne(doc);
  const created = await collection.findOne({ _id: result.insertedId });
  logger.info(`createSocialAdAccount: created ${name}`);
  return toUiAccount(created);
}

export async function updateSocialAdAccount(id, ui) {
  const collection = await getCollection("socialAdAccounts");
  const doc = await getSocialAdAccountById(id);
  if (!doc) return null;

  const rate = Number(ui.dollarRate) > 0 ? Number(ui.dollarRate) : Number(doc.dollarRate) || DEFAULT_DOLLAR_RATE;
  const rawId = String(ui.adAccountId || "").trim();
  const legacyId = rawId || doc.accountId;

  const update = {
    name: String(ui.adAccountName || "").trim(),
    accountId: legacyId,
    metaAccountId: legacyId,
    spendCap: Number(ui.monthlySpending) || Number(doc.spendCap) || 0,
    budget: Number(ui.monthlySpending) || Number(doc.budget) || 0,
    adAccountId: rawId,
    adAccountName: String(ui.adAccountName || "").trim(),
    platform: ui.platform,
    accountType: ui.accountType,
    dollarRate: rate,
    monthlySpending: Number(ui.monthlySpending) || 0,
    accountOwner: ui.accountOwner || doc.accountOwner || DEFAULT_OWNER,
    userGroupCode: ui.userGroupCode || doc.userGroupCode || "",
    accountStatus: ui.accountStatus || doc.accountStatus || "Available",
    adminId: ui.adminId || "",
    bmId: ui.bmId || "",
    bmName: ui.bmName || "",
    billingCard: ui.billingCard || ui.selectCard || "",
    selectCard: ui.selectCard || ui.billingCard || "",
    seriesId: ui.seriesId || "",
    assignAdAccount: ui.assignAdAccount || "",
    productType: ui.productType || "",
    fundAccountStatus: ui.fundAccountStatus ?? true,
    assignedCustomer: ui.assignedCustomer || doc.assignedCustomer || "",
    updatedAt: new Date(),
  };

  await collection.updateOne({ _id: new (await import("mongodb")).ObjectId(doc._id) }, { $set: update });
  const saved = await collection.findOne({ _id: new (await import("mongodb")).ObjectId(doc._id) });
  return toUiAccount(saved);
}

export async function deleteSocialAdAccount(id) {
  if (!id) return null;
  const collection = await getCollection("socialAdAccounts");
  const doc = await getSocialAdAccountById(id);
  if (!doc) return null;

  const { ObjectId } = await import("mongodb");
  await collection.deleteOne({ _id: new ObjectId(doc._id) });
  logger.info(`deleteSocialAdAccount: removed ${doc.adAccountName}`);
  return toUiAccount(doc);
}

export async function socialAdAccountExists(adAccountId) {
  const collection = await getCollection("socialAdAccounts");
  const doc = await collection.findOne({ adAccountId });
  return !!doc;
}

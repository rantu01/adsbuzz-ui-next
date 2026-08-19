import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_SETUPS } from "@/data/seedData";

const SETUP_STATUS = ["Active", "Terminated", "Replace"];
const SETUP_SERVICE_TYPES = ["Ad Account Sales Setup", "Others Sale Setup"];
const SETUP_PLATFORMS = ["Facebook", "TikTok", "Google", "Snapchat"];

function slugify(value, fallback = "") {
  const slug = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

// Seeding only needs to happen once per server process. Running the upsert loop
// on every GET made the sale-setup page (and modal) sluggish, so we memoize it.
let seedPromise = null;

function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedSaleSetups().catch((error) => {
      logger.error("seedSaleSetups failed.", error);
      seedPromise = null;
    });
  }
  return seedPromise;
}

// Accepts legacy values ("Ad Account Topup"/"Others") and normalizes them to
// the current sale-setup type names.
function normalizeServiceType(value) {
  const v = String(value || "");
  return v === "Others" || v === "Others Sale Setup" ? "Others Sale Setup" : "Ad Account Sales Setup";
}

function sanitize(input = {}) {
  const groupId = String(input.groupId || "").trim();
  const userId = String(input.userId || "").trim();
  const adName = String(input.adName || "").trim();
  const adAccountId = String(input.adAccountId || "").trim();
  const serviceType = normalizeServiceType(input.serviceType);
  const platform = SETUP_PLATFORMS.includes(input.platform) ? input.platform : "Facebook";
  const status = SETUP_STATUS.includes(input.status) ? input.status : "Active";

  return {
    groupId,
    userId,
    adName,
    adAccountId,
    serviceType,
    platform,
    dollarRate: Number(input.dollarRate) > 0 ? Number(input.dollarRate) : 0,
    monthlySpending: Number(input.monthlySpending) > 0 ? Number(input.monthlySpending) : 0,
    serviceDetails: String(input.serviceDetails || "").trim(),
    serviceFee: Number(input.serviceFee) > 0 ? Number(input.serviceFee) : 0,
    service: String(input.service || "").trim(),
    status,
  };
}

export async function seedSaleSetups() {
  const collection = await getCollection("saleSetups");
  await collection.createIndex({ id: 1 }, { unique: true });

  let seeded = 0;
  for (const s of INITIAL_SETUPS) {
    const doc = {
      id: `SETUP-${slugify(s.groupId, "G")}-${slugify(s.adAccountId || "OTHERS", "ACC")}`,
      ...sanitize(s),
      updatedAt: new Date(),
    };
    const result = await collection.updateOne(
      { id: doc.id },
      { $setOnInsert: doc },
      { upsert: true }
    );
    if (result.upsertedCount > 0) seeded += 1;
  }
  logger.info(`seedSaleSetups: seeded ${seeded} setups.`);
  return { seeded };
}

function mapSetup({ _id, ...rest }) {
  const mapped = { ...rest };
  if (mapped.serviceType) mapped.serviceType = normalizeServiceType(mapped.serviceType);
  return mapped;
}

export async function listSaleSetups({ search = "" } = {}) {
  await ensureSeeded();
  const collection = await getCollection("saleSetups");
  const items = await collection.find({}).sort({ groupId: 1, adName: 1 }).toArray();

  let result = items;
  if (search) {
    const q = search.toLowerCase();
    result = items.filter(
      (s) =>
        s.adName?.toLowerCase().includes(q) ||
        s.groupId?.toLowerCase().includes(q) ||
        s.userId?.toLowerCase().includes(q) ||
        s.adAccountId?.toLowerCase().includes(q)
    );
  }
  return result.map(mapSetup);
}

export async function getSaleSetupById(id) {
  await ensureSeeded();
  const collection = await getCollection("saleSetups");
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return { ...mapSetup(doc), _id: doc._id };
}

export async function createSaleSetup(data) {
  const collection = await getCollection("saleSetups");
  const setup = sanitize(data);

  if (!setup.groupId) {
    throw new Error("GROUP_REQUIRED");
  }
  if (setup.serviceType === "Ad Account Sales Setup" && !setup.adAccountId) {
    throw new Error("ACCOUNT_REQUIRED");
  }
  if (setup.serviceType === "Others Sale Setup" && !setup.serviceDetails) {
    throw new Error("DETAILS_REQUIRED");
  }

  // A new setup is only blocked when an ACTIVE setup already exists for the same
  // group + ad account. Terminated (e.g. unassigned) or replaced setups stay in
  // the database for history but no longer prevent creating a fresh setup from
  // scratch when the account is assigned to the group again.
  const duplicateQuery =
    setup.serviceType === "Others Sale Setup"
      ? { groupId: setup.groupId, serviceType: "Others Sale Setup", serviceDetails: setup.serviceDetails, status: "Active" }
      : { groupId: setup.groupId, adAccountId: setup.adAccountId, status: "Active" };
  const existing = await collection.findOne(duplicateQuery);
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const doc = {
    id: `SETUP-${slugify(setup.groupId, "G")}-${slugify(setup.adAccountId || "OTHERS", "ACC")}-${Date.now().toString().slice(-4)}`,
    ...setup,
    updatedAt: new Date(),
  };
  await collection.insertOne(doc);
  logger.info(`createSaleSetup: created setup for ${doc.groupId}`);
  return { ...mapSetup(doc), _id: doc._id };
}

export async function updateSaleSetup(id, data) {
  const collection = await getCollection("saleSetups");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const patch = {};
  for (const key of [
    "groupId",
    "userId",
    "adName",
    "adAccountId",
    "serviceType",
    "platform",
    "dollarRate",
    "monthlySpending",
    "serviceDetails",
    "serviceFee",
    "service",
    "status",
  ]) {
    if (!(key in data)) continue;
    const value = data[key];
    if (key === "status") patch.status = SETUP_STATUS.includes(value) ? value : existing.status;
    else if (key === "platform") patch.platform = SETUP_PLATFORMS.includes(value) ? value : existing.platform;
    else if (key === "serviceType") patch.serviceType = normalizeServiceType(value);
    else if (key === "dollarRate") patch.dollarRate = Number(value) > 0 ? Number(value) : 0;
    else if (key === "monthlySpending") patch.monthlySpending = Number(value) > 0 ? Number(value) : 0;
    else if (key === "serviceFee") patch.serviceFee = Number(value) > 0 ? Number(value) : 0;
    else patch[key] = String(value || "").trim();
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ id }, { $set: patch });
  const updated = await collection.findOne({ id });
  return { ...mapSetup(updated), _id: updated._id };
}

/**
 * Terminates the active "Ad Account Sales Setup" entries tied to an ad account.
 * Used when an ad account is unassigned from a customer so the topup setup is
 * automatically closed. Only the setup record's status flips to "Terminated" —
 * existing sales/history (invoices) are never touched.
 */
export async function terminateSaleSetupsForAccount({ adAccountId, groupId } = {}) {
  const account = String(adAccountId || "").trim();
  if (!account) return 0;

  const collection = await getCollection("saleSetups");
  const filter = {
    serviceType: "Ad Account Sales Setup",
    adAccountId: account,
    status: "Active",
  };
  const group = String(groupId || "").trim();
  if (group) filter.groupId = group;

  const result = await collection.updateMany(filter, {
    $set: { status: "Terminated", updatedAt: new Date() },
  });
  if (result.modifiedCount > 0) {
    logger.info(`terminateSaleSetupsForAccount: terminated ${result.modifiedCount} setup(s) for account ${account}.`);
  }
  return result.modifiedCount;
}

/**
 * Terminates every active "Ad Account Sales Setup" tied to a customer group.
 * Used when a customer is deleted so the setups for that group are automatically
 * closed. Only the setup records' status flips to "Terminated" — existing
 * sales/history (invoices) are never touched.
 */
export async function terminateSaleSetupsForGroup(groupId) {
  const group = String(groupId || "").trim();
  if (!group) return 0;

  const collection = await getCollection("saleSetups");
  const result = await collection.updateMany(
    {
      serviceType: "Ad Account Sales Setup",
      groupId: group,
      status: "Active",
    },
    { $set: { status: "Terminated", updatedAt: new Date() } }
  );
  if (result.modifiedCount > 0) {
    logger.info(`terminateSaleSetupsForGroup: terminated ${result.modifiedCount} setup(s) for group ${group}.`);
  }
  return result.modifiedCount;
}

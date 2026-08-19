import { getCollection, hasSeeded, markSeeded } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_PLATFORMS } from "@/data/seedData";

const PLATFORM_STATUS = ["Active", "Disabled"];

function sanitize(input = {}) {
  const platformId = String(input.platformId || "").trim();
  const platformName = String(input.platformName || "").trim();
  const platformLogo = String(input.platformLogo || "").trim();
  const status = PLATFORM_STATUS.includes(input.status) ? input.status : "Active";
  return { platformId, platformName, platformLogo, status };
}

export async function seedPlatforms() {
  if (await hasSeeded("platforms")) return { seeded: 0 };

  const collection = await getCollection("platforms");
  let seeded = 0;

  if ((await collection.countDocuments()) === 0) {
    const docs = INITIAL_PLATFORMS.map((p) => ({
      ...p,
      platformId: String(p.platformId || `PLAT-${Date.now()}`),
      platformName: String(p.platformName || ""),
      platformLogo: String(p.platformLogo || ""),
      status: PLATFORM_STATUS.includes(p.status) ? p.status : "Active",
      updatedAt: new Date(),
    }));

    if (docs.length > 0) {
      await collection.insertMany(docs);
    }
    seeded = docs.length;
  }

  await markSeeded("platforms");
  logger.info(`seedPlatforms: seeded ${seeded} platforms.`);
  return { seeded };
}

function mapPlatform({ _id, ...rest }) {
  return { ...rest };
}

export async function listPlatforms() {
  await seedPlatforms();
  const collection = await getCollection("platforms");
  const items = await collection.find({}).sort({ platformName: 1 }).toArray();
  return items.map(mapPlatform);
}

export async function getPlatformById(platformId) {
  await seedPlatforms();
  const collection = await getCollection("platforms");
  const doc = await collection.findOne({ platformId });
  if (!doc) return null;
  return { ...mapPlatform(doc), _id: doc._id };
}

export async function createPlatform(data) {
  const collection = await getCollection("platforms");
  const platform = sanitize(data);

  if (!platform.platformId) {
    platform.platformId = `PLAT-${Date.now().toString().slice(-3)}`;
  }

  const existing = await collection.findOne({ platformId: platform.platformId });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const existingName = await collection.findOne({ platformName: platform.platformName });
  if (existingName) {
    throw new Error("DUPLICATE_NAME");
  }

  const doc = { ...platform, updatedAt: new Date() };
  const result = await collection.insertOne(doc);
  return { ...mapPlatform(doc), _id: result.insertedId };
}

export async function updatePlatform(platformId, data) {
  const collection = await getCollection("platforms");
  const existing = await collection.findOne({ platformId });
  if (!existing) return null;

  const allowed = ["platformName", "platformLogo", "status"];
  const patch = {};
  for (const key of allowed) {
    if (!(key in data)) continue;
    if (key === "status") {
      patch.status = PLATFORM_STATUS.includes(data[key]) ? data[key] : existing.status;
    } else {
      patch[key] = String(data[key] || "").trim();
    }
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ platformId }, { $set: patch });
  const updated = await collection.findOne({ platformId });
  return { ...mapPlatform(updated), _id: updated._id };
}

export async function togglePlatformStatus(platformId) {
  const collection = await getCollection("platforms");
  const existing = await collection.findOne({ platformId });
  if (!existing) return null;

  const nextStatus = existing.status === "Active" ? "Disabled" : "Active";
  await collection.updateOne({ platformId }, { $set: { status: nextStatus, updatedAt: new Date() } });
  const updated = await collection.findOne({ platformId });
  return { ...mapPlatform(updated), _id: updated._id };
}

export async function deletePlatform(platformId) {
  const collection = await getCollection("platforms");
  const existing = await collection.findOne({ platformId });
  if (!existing) return null;

  await collection.deleteOne({ platformId });
  return { ...mapPlatform(existing), _id: existing._id };
}

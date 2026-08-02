import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_SERIES } from "@/data/seedData";

const SERIES_STATUS = ["Active", "Sold", "Disable", "Need Support", "Available"];
const SERIES_PLATFORMS = ["Facebook", "TikTok", "Google", "Snapchat"];

function sanitize(input = {}) {
  const seriesId = String(input.seriesId || "").trim();
  const seriesName = String(input.seriesName || "").trim();
  const platform = SERIES_PLATFORMS.includes(input.platform) ? input.platform : "Facebook";
  const status = SERIES_STATUS.includes(input.status) ? input.status : "Active";
  return { seriesId, seriesName, platform, status };
}

export async function seedSeries() {
  const collection = await getCollection("series");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_SERIES.map((s) => ({
    ...s,
    seriesId: String(s.seriesId || s.seriesName),
    platform: s.platform || "Facebook",
    status: s.status || "Active",
    updatedAt: new Date(),
  }));

  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  logger.info(`seedSeries: seeded ${docs.length} series.`);
  return { seeded: docs.length };
}

export async function listSeries({ search = "" } = {}) {
  await seedSeries();
  const collection = await getCollection("series");
  const cursor = collection.find({}).sort({ seriesName: 1 });
  const items = await cursor.toArray();

  let result = items;
  if (search) {
    const q = search.toLowerCase();
    result = items.filter(
      (s) =>
        s.seriesId?.toLowerCase().includes(q) ||
        s.seriesName?.toLowerCase().includes(q) ||
        s.platform?.toLowerCase().includes(q)
    );
  }
  return result.map(({ _id, ...rest }) => rest);
}

export async function getSeriesByCode(seriesId) {
  await seedSeries();
  const collection = await getCollection("series");
  const doc = await collection.findOne({ seriesId });
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

export async function createSeries(data) {
  const collection = await getCollection("series");
  const s = sanitize(data);

  if (!s.seriesId) {
    s.seriesId = `SERIES-${Date.now().toString().slice(-3)}`;
  }

  const existing = await collection.findOne({ seriesId: s.seriesId });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const doc = {
    ...s,
    updatedAt: new Date(),
  };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  return { ...rest, id: _id };
}

export async function updateSeries(seriesId, data) {
  const collection = await getCollection("series");
  const existing = await collection.findOne({ seriesId });
  if (!existing) return null;

  const allowed = Object.keys(data).filter((k) =>
    ["seriesName", "platform", "status"].includes(k)
  );
  const patch = {};
  for (const key of allowed) {
    if (key === "platform") patch.platform = SERIES_PLATFORMS.includes(data[key]) ? data[key] : existing.platform;
    else if (key === "status") patch.status = SERIES_STATUS.includes(data[key]) ? data[key] : existing.status;
    else patch[key] = String(data[key] || "").trim();
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ seriesId }, { $set: patch });
  const updated = await collection.findOne({ seriesId });
  const { _id, ...rest } = updated;
  return { ...rest, id: _id };
}
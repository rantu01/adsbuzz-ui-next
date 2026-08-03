import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_ACTIVITIES } from "@/data/seedData";

const ACTIVITY_TYPES = ["sale", "system", "payment", "account", "customer"];

function toTimeLabel(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function sanitize(input = {}) {
  const user = String(input.user || "").trim() || "System";
  const action = String(input.action || "").trim();
  const details = String(input.details || "").trim();
  const type = ACTIVITY_TYPES.includes(input.type) ? input.type : "system";
  return { user, action, details, type };
}

export async function seedActivities() {
  const collection = await getCollection("activities");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const now = Date.now();
  const docs = INITIAL_ACTIVITIES.map((a, index) => ({
    ...sanitize(a),
    id: String(a.id || `act-${now}-${index}`),
    time: String(a.time || ""),
    createdAt: new Date(now - index * 60 * 1000),
  }));
  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  logger.info(`seedActivities: seeded ${docs.length} activities.`);
  return { seeded: docs.length };
}

function mapActivity({ _id, ...rest }) {
  return { ...rest };
}

export async function listActivities({ limit = 100 } = {}) {
  await seedActivities();
  const collection = await getCollection("activities");
  const items = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(Number(limit) || 100)
    .toArray();
  return items.map(mapActivity);
}

export async function createActivity(data = {}) {
  const collection = await getCollection("activities");
  const now = new Date();
  const activity = {
    ...sanitize(data),
    id: String(data.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
    time: String(data.time || toTimeLabel(now)),
    createdAt: now,
  };
  const result = await collection.insertOne(activity);
  logger.info(`createActivity: ${activity.action}`);
  return { ...mapActivity(activity), _id: result.insertedId };
}

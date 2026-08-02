import { MongoClient } from "mongodb";
import config from "@/config";
import logger from "@/utils/logger";

if (!config.db.uri) {
  throw new Error("Please define the MONGODB_URI environment variable inside .env.local");
}

let client;
let clientPromise;

if (config.isDevelopment) {
  if (!global._adsbuzzMongoClientPromise) {
    client = new MongoClient(config.db.uri);
    global._adsbuzzMongoClientPromise = client.connect();
  }
  clientPromise = global._adsbuzzMongoClientPromise;
} else {
  client = new MongoClient(config.db.uri);
  clientPromise = client.connect();
}

export async function getClient() {
  return clientPromise;
}

export async function getDb() {
  const client = await getClient();
  return client.db(config.db.name);
}

export async function getCollection(name) {
  const db = await getDb();
  return db.collection(name);
}

export async function pingDatabase() {
  try {
    const client = await getClient();
    await client.db(config.db.name).command({ ping: 1 });
    logger.info("MongoDB connection verified.");
    return { ok: true };
  } catch (error) {
    logger.error("MongoDB connection failed.", error);
    return { ok: false, error: error.message };
  }
}

export default clientPromise;

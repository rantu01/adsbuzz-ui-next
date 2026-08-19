import { getCollection, hasSeeded, markSeeded } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_CARDS } from "@/data/seedData";

const CARD_STATUS = [
  "Active",
  "Available",
  "Disable",
  "Disabled",
  "Restricted",
  "FB Restricted",
  "Need Support",
];
const CARD_TYPES = ["Visa", "Mastercard", "Union Pay", "American Express"];

function sanitize(input = {}) {
  const id = String(input.id || "").trim();
  const cardName = String(input.cardName || "").trim();
  const cardType = input.cardType ? String(input.cardType).trim() : "Visa";
  const cardPlatform = input.cardPlatform ? String(input.cardPlatform).trim() : "";
  const cardInitial = String(input.cardInitial || "").trim().toUpperCase();
  const status = CARD_STATUS.includes(input.status) ? input.status : "Active";
  const platformId = String(input.platformId || "").trim();
  const walletId = String(input.walletId || "").trim();
  const cardWallet = input.cardWallet ? String(input.cardWallet).trim() : "";

  const linkedAccountsCount = Number(input.linkedAccountsCount) > 0 ? Number(input.linkedAccountsCount) : 0;
  const usageCount = Number(input.usageCount) > 0 ? Number(input.usageCount) : 0;
  const totalLoadedUSD = Number(input.totalLoadedUSD) > 0 ? Number(input.totalLoadedUSD) : 0;

  return { id, cardName, cardType, cardPlatform, cardInitial, status, linkedAccountsCount, usageCount, totalLoadedUSD, platformId, walletId, cardWallet };
}

export async function seedCards() {
  if (await hasSeeded("cards")) return { seeded: 0 };

  const collection = await getCollection("cards");
  await collection.createIndex({ cardName: 1 }, { unique: true });

  let seeded = 0;
  if ((await collection.countDocuments()) === 0) {
    for (const c of INITIAL_CARDS) {
      const doc = {
        id: String(c.id || `CARD-${c.cardName}`),
        cardName: String(c.cardName || ""),
        cardInitial: String(c.cardInitial || "").toUpperCase(),
        cardType: String(c.cardType || "Visa"),
        cardPlatform: String(c.cardPlatform || ""),
        status: CARD_STATUS.includes(c.status) ? c.status : "Active",
        platformId: String(c.platformId || ""),
        walletId: String(c.walletId || ""),
        cardWallet: String(c.cardWallet || ""),
        linkedAccountsCount: Number(c.linkedAccountsCount) || 0,
        usageCount: Number(c.usageCount) || 0,
        totalLoadedUSD: Number(c.totalLoadedUSD) || 0,
        updatedAt: new Date(),
      };
      const result = await collection.updateOne(
        { cardName: doc.cardName },
        { $setOnInsert: doc },
        { upsert: true }
      );
      if (result.upsertedCount > 0) seeded += 1;
    }
  }
  await markSeeded("cards");
  logger.info(`seedCards: seeded ${seeded} cards.`);
  return { seeded };
}

function mapCard({ _id, ...rest }) {
  return { ...rest };
}

export async function listCards() {
  await seedCards();
  const collection = await getCollection("cards");
  const items = await collection.find({}).sort({ cardName: 1 }).toArray();
  return items.map(mapCard);
}

export async function getCardById(id) {
  await seedCards();
  const collection = await getCollection("cards");
  const doc = await collection.findOne({ id });
  if (!doc) return null;
  return { ...mapCard(doc), _id: doc._id };
}

export async function getCardByName(cardName) {
  await seedCards();
  const collection = await getCollection("cards");
  const doc = await collection.findOne({ cardName });
  if (!doc) return null;
  return { ...mapCard(doc), _id: doc._id };
}

export async function createCard(data) {
  const collection = await getCollection("cards");
  const card = sanitize(data);

  const existing = await collection.findOne({ cardName: card.cardName });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const doc = { ...card, updatedAt: new Date() };
  const result = await collection.insertOne(doc);
  return { ...mapCard(doc), _id: result.insertedId };
}

export async function updateCard(id, data) {
  const collection = await getCollection("cards");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const allowed = [
    "cardName",
    "cardInitial",
    "cardType",
    "cardPlatform",
    "status",
    "totalLoadedUSD",
    "platformId",
    "walletId",
    "cardWallet",
  ];
  const patch = {};
  for (const key of allowed) {
    if (!(key in data)) continue;
    const value = data[key];
    if (key === "status") {
      patch.status = CARD_STATUS.includes(value) ? value : existing.status;
    } else if (key === "totalLoadedUSD") {
      patch.totalLoadedUSD = Number(value) > 0 ? Number(value) : 0;
    } else if (key === "cardInitial") {
      patch.cardInitial = String(value || "").trim().toUpperCase();
    } else if (key === "cardName") {
      patch.cardName = String(value || "").trim();
    } else {
      patch[key] = String(value || "").trim();
    }
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ id }, { $set: patch });
  const updated = await collection.findOne({ id });
  return { ...mapCard(updated), _id: updated._id };
}

export async function toggleCardStatus(id) {
  const collection = await getCollection("cards");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const nextStatus = existing.status === "Active" ? "Disable" : "Active";
  await collection.updateOne({ id }, { $set: { status: nextStatus, updatedAt: new Date() } });
  const updated = await collection.findOne({ id });
  return { ...mapCard(updated), _id: updated._id };
}

export async function deleteCard(id) {
  const collection = await getCollection("cards");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  await collection.deleteOne({ id });
  return { ...mapCard(existing), _id: existing._id };
}

export async function applyCardLoad(cardName, topupAmountUSD) {
  const collection = await getCollection("cards");
  const existing = await collection.findOne({ cardName });
  if (!existing) return null;

  const amount = Number(topupAmountUSD) > 0 ? Number(topupAmountUSD) : 0;
  const result = await collection.findOneAndUpdate(
    { cardName },
    {
      $inc: { usageCount: 1, totalLoadedUSD: amount },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  const doc = result.value || result;
  if (!doc) return null;
  return { ...mapCard(doc), _id: doc._id };
}
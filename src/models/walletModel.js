import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_WALLETS } from "@/data/seedData";

const SECURITY_STATUS = ["High", "Medium", "Low"];
const WALLET_STATUS = ["Active", "Restricted"];

function sanitize(input = {}) {
  const walletId = String(input.walletId || "").trim();
  const ownerName = String(input.ownerName || "").trim();
  const idCardInfo = String(input.idCardInfo || "").trim();
  const sourceBy = String(input.sourceBy || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const accountSecurityStatus = SECURITY_STATUS.includes(input.accountSecurityStatus)
    ? input.accountSecurityStatus
    : "Medium";
  const walletStatus = WALLET_STATUS.includes(input.walletStatus) ? input.walletStatus : "Active";
  return { walletId, ownerName, idCardInfo, sourceBy, email, accountSecurityStatus, walletStatus };
}

export async function seedWallets() {
  const collection = await getCollection("wallets");
  const count = await collection.countDocuments();
  if (count > 0) return { seeded: 0 };

  const docs = INITIAL_WALLETS.map((w) => ({
    ...w,
    walletId: String(w.walletId || `WALLET-${Date.now()}`),
    ownerName: String(w.ownerName || ""),
    idCardInfo: String(w.idCardInfo || ""),
    sourceBy: String(w.sourceBy || ""),
    email: String(w.email || "").trim().toLowerCase(),
    accountSecurityStatus: SECURITY_STATUS.includes(w.accountSecurityStatus) ? w.accountSecurityStatus : "Medium",
    walletStatus: WALLET_STATUS.includes(w.walletStatus) ? w.walletStatus : "Active",
    updatedAt: new Date(),
  }));

  if (docs.length > 0) {
    await collection.insertMany(docs);
  }
  logger.info(`seedWallets: seeded ${docs.length} wallets.`);
  return { seeded: docs.length };
}

function mapWallet({ _id, ...rest }) {
  return { ...rest };
}

export async function listWallets() {
  await seedWallets();
  const collection = await getCollection("wallets");
  const items = await collection.find({}).sort({ ownerName: 1 }).toArray();
  return items.map(mapWallet);
}

export async function getWalletById(walletId) {
  await seedWallets();
  const collection = await getCollection("wallets");
  const doc = await collection.findOne({ walletId });
  if (!doc) return null;
  return { ...mapWallet(doc), _id: doc._id };
}

export async function createWallet(data) {
  const collection = await getCollection("wallets");
  const wallet = sanitize(data);

  if (!wallet.walletId) {
    wallet.walletId = `WALLET-${Date.now().toString().slice(-3)}`;
  }

  const existing = await collection.findOne({ walletId: wallet.walletId });
  if (existing) {
    throw new Error("DUPLICATE");
  }

  const existingEmail = await collection.findOne({ email: wallet.email });
  if (existingEmail) {
    throw new Error("DUPLICATE_EMAIL");
  }

  const doc = { ...wallet, updatedAt: new Date() };
  const result = await collection.insertOne(doc);
  return { ...mapWallet(doc), _id: result.insertedId };
}

export async function updateWallet(walletId, data) {
  const collection = await getCollection("wallets");
  const existing = await collection.findOne({ walletId });
  if (!existing) return null;

  const allowed = ["ownerName", "idCardInfo", "sourceBy", "email", "accountSecurityStatus", "walletStatus"];
  const patch = {};
  for (const key of allowed) {
    if (!(key in data)) continue;
    if (key === "accountSecurityStatus") {
      patch.accountSecurityStatus = SECURITY_STATUS.includes(data[key]) ? data[key] : existing.accountSecurityStatus;
    } else if (key === "walletStatus") {
      patch.walletStatus = WALLET_STATUS.includes(data[key]) ? data[key] : existing.walletStatus;
    } else if (key === "email") {
      patch.email = String(data[key] || "").trim().toLowerCase();
    } else {
      patch[key] = String(data[key] || "").trim();
    }
  }

  patch.updatedAt = new Date();
  await collection.updateOne({ walletId }, { $set: patch });
  const updated = await collection.findOne({ walletId });
  return { ...mapWallet(updated), _id: updated._id };
}

export async function deleteWallet(walletId) {
  const collection = await getCollection("wallets");
  const existing = await collection.findOne({ walletId });
  if (!existing) return null;

  await collection.deleteOne({ walletId });
  return { ...mapWallet(existing), _id: existing._id };
}

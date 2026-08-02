import { getDb } from "@/lib/db";

const ID_PREFIX = "ADB5";

export async function getNextNumericId() {
  const db = await getDb();
  const result = await db.collection("counters").findOneAndUpdate(
    { _id: "userId" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  const counter = result.value || result;
  return counter.seq;
}

export function formatUserId(seq) {
  const num = Number(seq);
  if (!num || num < 1) return null;
  return `${ID_PREFIX}${String(num).padStart(4, "0")}`;
}

export async function getUserByUid(uid) {
  if (!uid) return null;
  const db = await getDb();
  return db.collection("users").findOne({ uid }, { projection: { password: 0 } });
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const db = await getDb();
  return db
    .collection("users")
    .findOne({ email: email.trim().toLowerCase() }, { projection: { password: 0 } });
}

export async function updateUserByUid(uid, updates) {
  if (!uid) return null;
  const db = await getDb();
  await db.collection("users").updateOne(
    { uid },
    { $set: { ...updates, updatedAt: new Date() } }
  );
  return getUserByUid(uid);
}

export async function syncAuthenticatedUser({ uid, email, displayName = "", phoneNumber = "" }) {
  if (!uid || !email) {
    throw new Error("uid and email are required.");
  }

  const db = await getDb();
  const usersCollection = db.collection("users");
  const existingUser = await usersCollection.findOne({ uid });
  const now = new Date();

  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

  let numericId = existingUser?.numericId;
  if (!numericId) {
    numericId = await getNextNumericId();
  }

  const customId = formatUserId(numericId);

  await usersCollection.updateOne(
    { uid },
    {
      $set: {
        email: normalizedEmail,
        displayName: displayName || "",
        phoneNumber: phoneNumber || "",
        accountStatus: existingUser?.accountStatus || "active",
        lastLoginAt: now,
        updatedAt: now,
        numericId,
        customId,
      },
      $setOnInsert: {
        role: "customer",
        availableBalance: 0,
        totalEarned: 0,
        groupName: "",
        createdAt: now,
      },
    },
    { upsert: true }
  );

  return getUserByUid(uid);
}

export async function creditUserBalance(uid, amount) {
  const db = await getDb();
  const numericAmount = Number(amount || 0);
  const result = await db.collection("users").findOneAndUpdate(
    { uid },
    {
      $inc: {
        availableBalance: numericAmount,
        totalEarned: numericAmount > 0 ? numericAmount : 0,
      },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" }
  );
  return result.value;
}

export async function debitUserBalance(uid, amount) {
  return creditUserBalance(uid, -Math.abs(Number(amount || 0)));
}

export function canUserWithdraw(user) {
  if (!user) return false;
  if (user.accountStatus === "frozen") return false;
  return true;
}

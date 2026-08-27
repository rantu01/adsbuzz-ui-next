import { getDb, getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { normalizeCustomerId, formatCustomerId } from "@/utils/customerIds";
import { terminateSaleSetupsForGroup } from "@/models/saleSetupModel";

export const CUSTOMER_STATUS = ["Active", "Inactive", "Lost"];
const DEFAULT_DOLLAR_RATE = 132;

// Heavy one-time data migrations (users -> customers, legacy logs -> invoices).
// They are expensive (full-collection scans + upserts) so they must NOT run on
// every read. We run them lazily once per server process; subsequent reads are
// served straight from the "customers" collection and stay fast.
let initialSyncPromise = null;

function ensureInitialSync() {
  if (!initialSyncPromise) {
    initialSyncPromise = (async () => {
      await migrateLegacyCustomerIds();
      await resolveDuplicateCustomerIds();
      await ensureCustomerIdUniqueIndex();
      await alignCustomerIdCounter();
      await syncCustomersFromUsers();
    })().catch((error) => {
      logger.error("Initial customer data sync failed.", error);
      initialSyncPromise = null;
    });
  }
  return initialSyncPromise;
}

/**
 * One-time, idempotent migration that renames any legacy `CUST-*` customer
 * ids (left over from the old user-sync or seed data) to the canonical
 * `ADB\d{6}` format, and updates every cross-collection reference so links
 * between customers, ad accounts and invoices stay intact.
 */
let migrationDone = false;
export async function migrateLegacyCustomerIds() {
  if (migrationDone) return { migrated: 0, skipped: true };
  migrationDone = true;

  try {
    const db = await getDb();
    const customersCollection = db.collection("customers");
    const adAccountsCollection = db.collection("socialAdAccounts");
    const invoicesCollection = db.collection("invoices");

    const legacyCustomers = await customersCollection
      .find({ id: { $not: { $regex: "^ADB\\d{6}$", $options: "i" } } })
      .project({ id: 1 })
      .toArray();

    const remap = {};
    let migrated = 0;
    for (const cust of legacyCustomers) {
      const newId = normalizeCustomerId(cust.id);
      if (newId && newId !== cust.id) {
        remap[cust.id] = newId;
        migrated += 1;
      }
    }

    for (const [oldId, newId] of Object.entries(remap)) {
      await customersCollection.updateOne({ id: oldId }, { $set: { id: newId, updatedAt: new Date() } });
      await adAccountsCollection.updateMany(
        { assignedCustomer: oldId },
        { $set: { assignedCustomer: newId, updatedAt: new Date() } },
      );
      await invoicesCollection.updateMany(
        { customerId: oldId },
        { $set: { customerId: newId, updatedAt: new Date() } },
      );
    }

    logger.info(`migrateLegacyCustomerIds: ${migrated} customer ids normalised.`);
    return { migrated, skipped: false, remap };
  } catch (error) {
    logger.error("migrateLegacyCustomerIds failed.", error);
    return { migrated: 0, skipped: false, error: error.message };
  }
}

/**
 * One-time, idempotent repair for any accidentally duplicated customer ids
 * (e.g. ADB550022 existing on two different customer documents). For each id
 * held by more than one customer, the "primary" record (the user-synced one
 * carrying a uid, otherwise the earliest created) keeps the id and every other
 * document is renumbered to a fresh counter-generated id. Because all cross
 * references (ad accounts, invoices, activities) are keyed on the customer id
 * string, existing business data stays attached to the kept record and the
 * renumbered document simply becomes its own distinct customer.
 */
let duplicateFixDone = false;
export async function resolveDuplicateCustomerIds() {
  if (duplicateFixDone) return { fixed: 0, skipped: true };
  try {
    const db = await getDb();
    const customersCollection = db.collection("customers");

    const groups = await customersCollection
      .aggregate([
        { $group: { _id: "$id", docs: { $push: "$$ROOT" } } },
        { $match: { $expr: { $gt: [{ $size: "$docs" }, 1] } } },
      ])
      .toArray();

    let fixed = 0;
    for (const group of groups) {
      const docs = group.docs;
      const primary =
        docs.find((d) => d.uid) ||
        docs.reduce((a, b) => (String(a.createdAt || "") <= String(b.createdAt || "") ? a : b));
      for (const doc of docs) {
        if (String(doc._id) === String(primary._id)) continue;
        const newId = await getNextCustomerId();
        await customersCollection.updateOne(
          { _id: doc._id },
          { $set: { id: newId, updatedAt: new Date() } }
        );
        fixed += 1;
        logger.info(
          `resolveDuplicateCustomerIds: renumbered ${doc.id} (${doc.name || doc.email}) -> ${newId}`
        );
      }
    }
    duplicateFixDone = true;
    if (fixed > 0) logger.info(`resolveDuplicateCustomerIds: ${fixed} duplicate customer id(s) fixed.`);
    return { fixed, skipped: false };
  } catch (error) {
    logger.error("resolveDuplicateCustomerIds failed.", error);
    return { fixed: 0, skipped: false, error: error.message };
  }
}

/**
 * Creates a unique index on customers.id so the database itself rejects any
 * future duplicate customer ids, even when two requests race concurrently.
 */
export async function ensureCustomerIdUniqueIndex() {
  const collection = await getCollection("customers");
  await collection.createIndex(
    { id: 1 },
    { unique: true, sparse: true, name: "unique_customer_id" }
  );
  return { ok: true };
}

/**
 * Cheap, idempotent safety net that runs on every customer list read. It groups
 * customers by their *normalised* id (so legacy CUST-* vs ADB* collisions are
 * caught too) and renumbers any duplicate that somehow slipped in (e.g. a race
 * before the unique index existed). The unique index prevents new duplicates,
 * so this is normally a no-op; it only does work when a duplicate exists.
 */
export async function reconcileDuplicateCustomerIds() {
  const collection = await getCollection("customers");
  const docs = await collection
    .find({ id: { $exists: true, $ne: "" } })
    .project({ id: 1, uid: 1, createdAt: 1 })
    .toArray();

  const byNormalized = new Map();
  for (const doc of docs) {
    const normalized = normalizeCustomerId(doc.id);
    if (!normalized) continue;
    if (!byNormalized.has(normalized)) byNormalized.set(normalized, []);
    byNormalized.get(normalized).push(doc);
  }

  let fixed = 0;
  for (const [, group] of byNormalized) {
    if (group.length <= 1) continue;
    const primary =
      group.find((d) => d.uid) ||
      group.reduce((a, b) =>
        String(a.createdAt || "") <= String(b.createdAt || "") ? a : b
      );
    for (const doc of group) {
      if (String(doc._id) === String(primary._id)) continue;
      const newId = await getNextCustomerId();
      await collection.updateOne(
        { _id: doc._id },
        { $set: { id: newId, updatedAt: new Date() } }
      );
      fixed += 1;
      logger.info(
        `reconcileDuplicateCustomerIds: renumbered ${doc.id} -> ${newId}`
      );
    }
  }

  if (fixed > 0) logger.info(`reconcileDuplicateCustomerIds: ${fixed} duplicate customer id(s) fixed.`);
  return { fixed };
}

/**
 * Re-aligns the customerId counter so newly generated ids can never re-enter
 * the range already occupied by user-synced customers (whose ids are derived
 * from the user record and were never tracked by the counter). The counter is
 * only ever raised, never lowered.
 */
export async function alignCustomerIdCounter() {
  const db = await getDb();
  const customersCollection = db.collection("customers");
  const maxDoc = await customersCollection
    .find({ id: { $regex: "^ADB\\d{6}$" } })
    .project({ id: 1 })
    .sort({ id: -1 })
    .limit(1)
    .toArray();
  const maxNumeric = maxDoc.length ? Number(maxDoc[0].id.slice(3)) : 0;
  // The counter stores the offset from CUSTOMER_ID_BASE (seq 1 -> ADB550001),
  // so the highest existing id's offset is maxNumeric - 550000.
  const maxSeq = Math.max(0, maxNumeric - 550000);
  await db.collection("counters").updateOne(
    { _id: "customerId", seq: { $lt: maxSeq } },
    { $set: { seq: maxSeq } }
  );
  return { maxSeq };
}

function toDateString(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split("T")[0];
}

function initials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function mapAccountStatus(accountStatus) {
  if (accountStatus === "frozen") return "Inactive";
  return "Active";
}

function slugify(value, fallback = "") {
  const slug = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/**
 * Derive a canonical `ADB\d{6}` customer id from a synced user record.
 * Preserves an explicit `customId` (normalised if legacy) or builds one
 * from the user's `numericId` so every customer id is consistent.
 */
function normalizeIdFromUser(user) {
  if (user.customId) {
    return normalizeCustomerId(user.customId) || String(user.customId);
  }
  if (user.numericId != null && String(user.numericId).trim() !== "") {
    return formatCustomerId(Number(user.numericId));
  }
  return formatCustomerId(0);
}

function mapUserToCustomer(user) {
  const rate = Number(user.dollarRate) > 0 ? Number(user.dollarRate) : DEFAULT_DOLLAR_RATE;
  const balanceUSD = Number(user.availableBalance || 0);
  return {
    id: normalizeIdFromUser(user),
    uid: user.uid || null,
    name: user.displayName || user.email || "Unnamed Customer",
    email: user.email || "",
    phone: user.phoneNumber || "",
    companyName: user.companyName || "",
    status: mapAccountStatus(user.accountStatus),
    createdAt: toDateString(user.createdAt),
    balanceBDT: balanceUSD * rate,
    balanceUSD,
    creditLimitUSD: Number(user.creditLimitUSD || 0),
    groupId: user.groupName || "",
    notes: user.notes || "",
    avatar: user.avatar || initials(user.displayName) || "",
    favorite: Boolean(user.favorite),
    role: user.role || "customer",
  };
}

// Serialises every customer-id allocation through a single promise chain so two
// concurrent requests can never observe the same counter value before either one
// has inserted its document (the unique id index remains the final backstop).
let customerIdChain = Promise.resolve();
function withCustomerIdLock(fn) {
  const run = customerIdChain.then(fn, fn);
  customerIdChain = run.catch(() => {});
  return run;
}

function getNextCustomerId() {
  return withCustomerIdLock(async () => {
    const db = await getDb();
    const customersCollection = db.collection("customers");
    // The counter increment is atomic, but the id space is shared with
    // user-synced customers whose ids were never tracked by the counter. Loop
    // until we land on an id that is not already in use.
    for (;;) {
      const result = await db.collection("counters").findOneAndUpdate(
        { _id: "customerId" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
      );
      const counter = result.value || result;
      const id = `ADB${String(550000 + counter.seq)}`;
      const taken = await customersCollection.findOne({ id }, { projection: { _id: 1 } });
      if (!taken) return id;
    }
  });
}

export async function syncCustomersFromUsers() {
  try {
    const db = await getDb();
    const users = await db
      .collection("users")
      .find({ role: "customer", deleted: { $ne: true } })
      .project({ password: 0 })
      .toArray();

    const customersCollection = db.collection("customers");
    let inserted = 0;
    let updated = 0;

    for (const user of users) {
      const base = mapUserToCustomer(user);

      // The user's customer may already exist under a different id than the
      // one derived from the user record (e.g. a previous collision fell back
      // to the counter). Reuse that id so a user never spawns duplicate docs.
      const existingByUid = await customersCollection.findOne(
        { uid: base.uid },
        { projection: { id: 1 } }
      );
      if (existingByUid) {
        base.id = existingByUid.id;
      } else {
        // The user-derived id space (ADB55xxxx from user customId/numericId)
        // overlaps the counter-generated range. Never hijack an id owned by a
        // different customer — allocate a fresh counter id instead.
        const takenById = await customersCollection.findOne(
          { id: base.id },
          { projection: { uid: 1 } }
        );
        if (takenById && takenById.uid && takenById.uid !== base.uid) {
          base.id = await getNextCustomerId();
        }
      }

      const update = {
        $set: {
          uid: base.uid,
          name: base.name,
          email: base.email,
          phone: base.phone,
          groupId: base.groupId,
          role: base.role,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          companyName: "",
          status: base.status,
          createdAt: base.createdAt,
          balanceBDT: base.balanceBDT,
          balanceUSD: base.balanceUSD,
          creditLimitUSD: base.creditLimitUSD,
          notes: "",
          avatar: base.avatar,
          favorite: false,
        },
      };

      let result;
      try {
        result = await customersCollection.updateOne({ id: base.id }, update, { upsert: true });
      } catch (err) {
        // Rare race with a concurrent insert — the unique id index rejected us,
        // so grab a fresh counter id and retry once.
        if (err?.code === 11000) {
          base.id = await getNextCustomerId();
          result = await customersCollection.updateOne({ id: base.id }, update, { upsert: true });
        } else {
          throw err;
        }
      }
      if (result.upsertedCount > 0) inserted += 1;
      else updated += 1;
    }

    logger.info(`syncCustomersFromUsers: ${inserted} inserted, ${updated} updated.`);
    return { inserted, updated };
  } catch (error) {
    logger.error("syncCustomersFromUsers failed.", error);
    throw error;
  }
}

export async function listCustomers({ search = "", status = "", favorite = "" } = {}) {
  await ensureInitialSync();
  const collection = await getCollection("customers");

  const filter = {};
  if (status && status !== "All") filter.status = status;
  if (favorite === "true") filter.favorite = true;

  // Guard against any customer-id duplicates slipping into the collection so the
  // UI can never display two rows with the same Customer ID.
  await reconcileDuplicateCustomerIds();

  let cursor = collection.find(filter).sort({ createdAt: 1, name: 1 });
  const customers = await cursor.toArray();

  // Normalise every id on read so legacy CUST-* values can never leak to the UI.
  const items = customers.map((c) => ({ ...c, id: normalizeCustomerId(c.id) || c.id }));

  if (search) {
    const q = search.toLowerCase();
    return items.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q) ||
        c.groupId?.toLowerCase().includes(q) ||
        (c.id || "").toLowerCase().includes(q),
    );
  }

  return items;
}

export async function getCustomerById(id) {
  if (!id) return null;
  await ensureInitialSync();
  const collection = await getCollection("customers");
  const normalized = normalizeCustomerId(id) || id;
  // Try the canonical id first, then fall back to the raw value for safety.
  const doc =
    (normalized !== id && (await collection.findOne({ id: normalized }))) ||
    (await collection.findOne({ id: id }));
  return doc ? { ...doc, id: normalizeCustomerId(doc.id) || doc.id } : null;
}

export async function createCustomer(data = {}) {
  await ensureInitialSync();
  const collection = await getCollection("customers");

  const explicitGroupId = data.groupId?.trim() || "";
  let groupId = explicitGroupId;

  if (explicitGroupId) {
    // An explicit group id must be unique — reject duplicates rather than
    // silently renaming so the user is forced to pick a fresh one.
    const taken = await collection.findOne({ groupId: explicitGroupId });
    if (taken) {
      const err = new Error(`Group ID "${explicitGroupId}" is already in use.`);
      err.code = "DUPLICATE_GROUP_ID";
      throw err;
    }
  } else {
    // Auto-generate a unique group id derived from the customer name.
    const base = data.name ? `GC-${slugify(data.name, data.name?.slice(0, 6))}` : "GC-GENERIC";
    groupId = await ensureUniqueGroupId(base);
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim().toLowerCase();

  // Allocate an id that is verified free up-front, then insert with a bounded
  // retry so a concurrent request racing to the same counter value can never
  // create a duplicate (the unique id index is the final backstop).
  let customer = null;
  for (let attempt = 0; attempt < 5 && !customer; attempt += 1) {
    const id = await getNextCustomerId();
    const candidate = {
      id,
      uid: null,
      name,
      email,
      phone: String(data.phone || "").trim(),
      companyName: String(data.companyName || "").trim(),
      status: CUSTOMER_STATUS.includes(data.status) ? data.status : "Active",
      createdAt: toDateString(new Date()),
      balanceBDT: 0,
      balanceUSD: 0,
      creditLimitUSD: Number(data.creditLimitUSD) > 0 ? Number(data.creditLimitUSD) : 0,
      groupId,
      notes: "",
      avatar: initials(name) || "",
      favorite: false,
      role: "customer",
      createdAtRaw: new Date(),
      updatedAt: new Date(),
    };
    try {
      await collection.insertOne(candidate);
      customer = candidate;
    } catch (err) {
      if (err?.code === 11000) continue;
      throw err;
    }
  }

  if (!customer) {
    throw new Error("Could not allocate a unique customer id. Please retry.");
  }

  logger.info(`createCustomer: created ${customer.id} (${customer.groupId})`);
  return customer;
}

/**
 * Guarantees a group id is unique within the customers collection.
 * If the proposed id is already taken, a numeric suffix is appended
 * until a free slot is found (e.g. GC-BIJOY -> GC-BIJOY-2).
 */
export async function ensureUniqueGroupId(groupId, excludeId = null) {
  if (!groupId) return groupId;
  const collection = await getCollection("customers");
  const proposal = String(groupId).trim();
  const taken = await collection.findOne(
    excludeId
      ? { groupId: proposal, id: { $ne: excludeId } }
      : { groupId: proposal },
  );
  if (!taken) return proposal;

  // find the highest existing numeric suffix and increment
  const escaped = proposal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existing = await collection
    .find({ groupId: { $regex: `^${escaped}(-\\d+)?$` } })
    .project({ groupId: 1 })
    .toArray();
  const suffixes = existing
    .map((c) => {
      const m = c.groupId.match(/-(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (suffixes.length ? Math.max(...suffixes) : 0) + 1;
  return `${proposal}-${next}`;
}

/**
 * Returns true when the group id is NOT already in use by another customer.
 */
export async function isGroupIdUnique(groupId, excludeId = null) {
  if (!groupId) return true;
  await ensureInitialSync();
  const collection = await getCollection("customers");
  const query = { groupId: String(groupId).trim() };
  if (excludeId) query.id = { $ne: excludeId };
  const doc = await collection.findOne(query);
  return !doc;
}

export async function checkGroupIdUnique(groupId, excludeId = null) {
  return isGroupIdUnique(groupId, excludeId);
}

const EDITABLE_FIELDS = [
  "name",
  "groupId",
  "companyName",
  "email",
  "phone",
  "creditLimitUSD",
  "status",
  "notes",
  "avatar",
];

export async function updateCustomer(id, data = {}) {
  if (!id) return null;
  await ensureInitialSync();
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const update = { updatedAt: new Date() };
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined) {
      if (field === "status" && !CUSTOMER_STATUS.includes(data.status)) continue;
      if (field === "groupId") {
        const proposed = String(data.groupId || "").trim();
        if (proposed) {
          const taken = await collection.findOne({ groupId: proposed, id: { $ne: id } });
          if (taken) {
            const err = new Error(`Group ID "${proposed}" is already in use.`);
            err.code = "DUPLICATE_GROUP_ID";
            throw err;
          }
          update[field] = proposed;
        }
      } else {
        update[field] = field === "creditLimitUSD" ? Number(data[field]) || 0 : data[field];
      }
    }
  }

  await collection.updateOne({ id }, { $set: update });
  return collection.findOne({ id });
}

export async function updateCustomerNotes(id, notes) {
  if (!id) return null;
  const collection = await getCollection("customers");
  await collection.updateOne(
    { id },
    { $set: { notes: String(notes || ""), updatedAt: new Date() } }
  );
  return collection.findOne({ id });
}

export async function toggleCustomerFavorite(id) {
  if (!id) return null;
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  const next = !Boolean(existing.favorite);
  await collection.updateOne(
    { id },
    { $set: { favorite: next, updatedAt: new Date() } }
  );
  return collection.findOne({ id });
}

export async function applyCustomerCredit(customerId, paidBDT, usd) {
  if (!customerId) return null;
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id: customerId });
  if (!existing) return null;

  const nextBDT = Math.round((Number(existing.balanceBDT || 0) + Number(paidBDT || 0)) * 100) / 100;
  const nextUSD = Math.round((Number(existing.balanceUSD || 0) + Number(usd || 0)) * 100) / 100;

  await collection.updateOne(
    { id: customerId },
    { $set: { balanceBDT: nextBDT, balanceUSD: nextUSD, updatedAt: new Date() } }
  );
  return collection.findOne({ id: customerId });
}

/**
 * Releases every ad account (in the socialAdAccounts collection) still assigned
 * to a deleted customer and auto-terminates the customer's active sale setups,
 * so no dangling references survive the deletion.
 */
export async function freeAdAccountsAssignedTo(customerId, groupId) {
  if (!customerId) return { freed: 0 };
  const db = await getDb();
  const now = new Date();

  const socialCollection = db.collection("socialAdAccounts");
  const socialResult = await socialCollection.updateMany(
    { assignedCustomer: customerId },
    {
      $set: {
        accountStatus: "Available",
        status: "available",
        assignedCustomer: "",
        uid: "",
        assignedBy: null,
        assignedAt: null,
        unassignedAt: now,
        updatedAt: now,
      },
    }
  );

  if (groupId) {
    await terminateSaleSetupsForGroup(groupId);
  }

  return {
    freed: socialResult.modifiedCount,
    adAccounts: socialResult.modifiedCount,
    socialAccounts: socialResult.modifiedCount,
  };
}

export async function deleteCustomer(id) {
  if (!id) return null;
  const collection = await getCollection("customers");
  const existing = await collection.findOne({ id });
  if (!existing) return null;

  await collection.deleteOne({ id });

  // Unassign any ad accounts still attached to this customer and terminate their
  // sale setups so a deleted customer never leaves dangling assignments behind.
  await freeAdAccountsAssignedTo(existing.id, existing.groupId);

  // Mark the underlying user as deleted so the one-time users -> customers sync
  // (which re-runs on every server restart) never resurrects this customer.
  if (existing.uid) {
    const db = await getDb();
    await db
      .collection("users")
      .updateOne(
        { uid: existing.uid },
        { $set: { deleted: true, deletedAt: new Date(), updatedAt: new Date() } }
      );
  }

  logger.info(`deleteCustomer: deleted ${existing.id} (${existing.name || existing.email})`);
  return existing;
}

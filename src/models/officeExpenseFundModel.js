import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";
import { parseStrictDateOnly } from "@/utils/invoiceMath";

const FUND_ID = "main";
const TXN_TYPES = ["opening", "fund", "expense", "expense_adjust", "expense_reversal"];
const ADD_TYPES_SAFE = ["fund", "opening"];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Single global wallet that funds all office expenses.
 * - Money is added via "Add Money" (type: 'fund').
 * - Every expense entry deducts from it (type: 'expense').
 * - Entry updates adjust by the delta; entry deletes refund.
 * - The balance lives in the `officeExpenseFund` singleton document and every
 *   movement is recorded in `officeExpenseFundTransactions`, so both the
 *   balance and the full history are persistent in the database.
 */
export async function ensureFund() {
  const collection = await getCollection("officeExpenseFund");
  const existing = await collection.findOne({ _id: FUND_ID });
  if (existing) {
    const { _id, ...rest } = existing;
    return { ...rest, id: FUND_ID };
  }

  // First run: cover everything already recorded (past entries + per-month
  // cash-in-hand) with an opening balance, so the available balance starts at
  // the current total cash-in-hand and no existing data is invalidated.
  const entriesCollection = await getCollection("officeExpenseEntries");
  const monthsCollection = await getCollection("officeExpenseMonths");
  let spent = 0;
  let onHand = 0;
  try {
    const entries = await entriesCollection.find({}).project({ amount: 1 }).toArray();
    spent = entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  } catch {
    spent = 0;
  }
  try {
    const months = await monthsCollection.find({}).project({ cashInHand: 1 }).toArray();
    onHand = months.reduce((sum, m) => sum + (Number(m.cashInHand) || 0), 0);
  } catch {
    onHand = 0;
  }

  const opening = Math.round((spent + onHand) * 100) / 100;
  const now = new Date();
  await collection.insertOne({
    _id: FUND_ID,
    balance: opening,
    totalFunded: opening,
    totalSpent: spent,
    createdAt: now,
    updatedAt: now,
  });
  if (opening > 0) {
    const txns = await getCollection("officeExpenseFundTransactions");
    await txns.insertOne({
      type: "opening",
      amount: opening,
      month: "",
      voucherNo: "",
      entryId: "",
      note: "Opening balance covering previously recorded expenses and cash in hand.",
      createdAt: now,
    });
  }
  logger.info(`ensureFund: seeded opening office-expense fund balance ${opening}.`);
  return { balance: opening, totalFunded: opening, totalSpent: spent, id: FUND_ID };
}

export async function getFund() {
  const fund = await ensureFund();
  return fund;
}

export async function listFundTransactions({ limit = 100 } = {}) {
  await ensureFund();
  const collection = await getCollection("officeExpenseFundTransactions");
  const items = await collection
    .find({})
    .sort({ createdAt: -1 })
    .limit(Math.max(1, Math.min(Number(limit) || 100, 500)))
    .toArray();
  return items.map(({ _id, ...rest }) => ({ ...rest, id: _id.toString() }));
}

function normalizeAddedBy(actor) {
  if (!actor) return null;
  if (typeof actor === "string") {
    const v = actor.trim();
    return v ? { name: v, username: v } : null;
  }
  const uid = actor.uid != null ? String(actor.uid) : "";
  const username = actor.username != null ? String(actor.username) : actor.name != null ? String(actor.name) : "";
  const name = actor.name != null ? String(actor.name) : username;
  const email = actor.email != null ? String(actor.email) : "";
  const role = actor.role != null ? String(actor.role) : "";
  if (!uid && !name && !email && !username && !role) return null;
  return {
    ...(uid ? { uid } : {}),
    ...(name ? { name } : {}),
    ...(username ? { username } : {}),
    ...(email ? { email } : {}),
    ...(role ? { role } : {}),
  };
}

function normalizeEditedBy(actor) {
  return normalizeAddedBy(actor);
}

async function resolveTxnFilter(id) {
  const raw = String(id || "").trim();
  if (!raw) return null;
  try {
    const { ObjectId } = await import("mongodb");
    if (ObjectId.isValid(raw)) return { _id: new ObjectId(raw) };
  } catch {
    // fall through to string-id match
  }
  return { _id: raw };
}

function mapTxn(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: _id != null ? _id.toString() : rest.id };
}

async function recordTransaction(txn) {
  const collection = await getCollection("officeExpenseFundTransactions");
  const type = TXN_TYPES.includes(txn.type) ? txn.type : "fund";
  // A caller-supplied funding date is stored as the entry's date (start of
  // day, UTC — same convention as historical invoices). When omitted, the
  // entry is stamped with the current time (unchanged behavior).
  let createdAt = new Date();
  if (txn.date !== undefined && txn.date !== null && String(txn.date).trim() !== "") {
    const parsed = parseStrictDateOnly(txn.date);
    if (!parsed) {
      const err = new Error("Invalid date (expected valid YYYY-MM-DD, year 2000 or later).");
      err.code = "INVALID_DATE";
      throw err;
    }
    createdAt = new Date(`${parsed}T00:00:00Z`);
  }
  const doc = {
    type,
    amount: toNumber(txn.amount),
    month: String(txn.month || ""),
    voucherNo: String(txn.voucherNo || ""),
    entryId: String(txn.entryId || ""),
    note: String(txn.note || ""),
    addedBy: normalizeAddedBy(txn.addedBy || txn.actor || null),
    createdAt,
  };
  await collection.insertOne(doc);
  const { _id, ...rest } = doc;
  return { ...rest };
}

function mapFund(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, id: FUND_ID };
}

function mapFundResult(result) {
  if (!result) return null;
  return mapFund(result.value || result);
}

export async function addFunds({ amount, note = "", month = "", date = "", actor = null, addedBy = null } = {}) {
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    const err = new Error("Amount must be a positive number.");
    err.code = "INVALID_AMOUNT";
    throw err;
  }
  await ensureFund();
  const collection = await getCollection("officeExpenseFund");
  const updated = await collection.findOneAndUpdate(
    { _id: FUND_ID },
    {
      $inc: { balance: amt, totalFunded: amt },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  const fund = mapFundResult(updated);
  await recordTransaction({ type: "fund", amount: amt, month, date, note, addedBy: addedBy || actor || null });
  logger.info(`addFunds: +${amt} office-expense fund (balance ${fund?.balance}).`);
  return fund;
}

/**
 * Atomically deduct an expense amount. The conditional update guarantees the
 * balance can never go negative, even under concurrent requests.
 * Throws INSUFFICIENT_BALANCE (with `available` attached) when funds are short.
 */
export async function deductForExpense({ amount, entryId = "", month = "", voucherNo = "", note = "" } = {}) {
  const amt = Number(amount) || 0;
  if (amt <= 0) return getFund();
  await ensureFund();
  const collection = await getCollection("officeExpenseFund");
  const updated = await collection.findOneAndUpdate(
    { _id: FUND_ID, balance: { $gte: amt } },
    {
      $inc: { balance: -amt, totalSpent: amt },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  const fund = mapFundResult(updated);
  if (!fund) {
    const current = await ensureFund();
    const err = new Error(
      `Insufficient available balance. Available: ৳${Number(current.balance || 0).toLocaleString()}, required: ৳${amt.toLocaleString()}. Please add money first.`,
    );
    err.code = "INSUFFICIENT_BALANCE";
    err.available = Number(current.balance || 0);
    throw err;
  }
  await recordTransaction({ type: "expense", amount: -amt, month, voucherNo, entryId, note });
  return fund;
}

/**
 * Adjust the fund when an entry amount changes. Only the positive delta is
 * balance-checked; a negative delta refunds the difference.
 */
export async function adjustForExpenseUpdate({ entryId = "", month = "", voucherNo = "", oldAmount = 0, newAmount = 0 } = {}) {
  const delta = Math.round((Number(newAmount) - Number(oldAmount)) * 100) / 100;
  if (delta === 0) return getFund();
  await ensureFund();
  const collection = await getCollection("officeExpenseFund");
  if (delta > 0) {
    const updated = await collection.findOneAndUpdate(
      { _id: FUND_ID, balance: { $gte: delta } },
      {
        $inc: { balance: -delta, totalSpent: delta },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: "after" },
    );
    const fund = mapFundResult(updated);
    if (!fund) {
      const current = await ensureFund();
      const err = new Error(
        `Insufficient available balance for this increase. Available: ৳${Number(current.balance || 0).toLocaleString()}, additional required: ৳${delta.toLocaleString()}. Please add money first.`,
      );
      err.code = "INSUFFICIENT_BALANCE";
      err.available = Number(current.balance || 0);
      throw err;
    }
    await recordTransaction({ type: "expense_adjust", amount: -delta, month, voucherNo, entryId });
    return fund;
  }
  const refund = Math.abs(delta);
  const updated = await collection.findOneAndUpdate(
    { _id: FUND_ID },
    {
      $inc: { balance: refund, totalSpent: -refund },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  const fund = mapFundResult(updated);
  await recordTransaction({ type: "expense_adjust", amount: refund, month, voucherNo, entryId });
  return fund;
}

/** Refund a deleted entry's amount back to the available balance. */
export async function refundForExpenseDelete({ entryId = "", month = "", voucherNo = "", amount = 0 } = {}) {
  const amt = Number(amount) || 0;
  if (amt <= 0) return getFund();
  await ensureFund();
  const collection = await getCollection("officeExpenseFund");
  const updated = await collection.findOneAndUpdate(
    { _id: FUND_ID },
    {
      $inc: { balance: amt, totalSpent: -amt },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  const fund = mapFundResult(updated);
  await recordTransaction({ type: "expense_reversal", amount: amt, month, voucherNo, entryId });
  return fund;
}

/**
 * Edit an "Ad Money History" funding transaction (type 'fund' or 'opening').
 * - Adjusts the wallet balance/totalFunded by the amount delta so totals stay
 *   consistent.
 * - Appends an entry to `editHistory` recording the old/new values, the edit
 *   note (reason), and the editor's username + role.
 */
export async function updateFundTransaction(id, { amount, note, editNote = "", actor = null } = {}) {
  const filter = await resolveTxnFilter(id);
  if (!filter) {
    const err = new Error("Transaction id is required.");
    err.code = "NOT_FOUND";
    throw err;
  }
  const txns = await getCollection("officeExpenseFundTransactions");
  const existing = await txns.findOne(filter);
  if (!existing) {
    const err = new Error("Ad money entry not found.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!ADD_TYPES_SAFE.includes(existing.type)) {
    const err = new Error("Only Ad Money entries can be edited from the wallet.");
    err.code = "NOT_EDITABLE";
    throw err;
  }

  const newAmount = Number(amount);
  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    const err = new Error("Amount must be a positive number.");
    err.code = "INVALID_AMOUNT";
    throw err;
  }
  const newNote = note === undefined ? String(existing.note || "") : String(note || "");
  const reason = String(editNote || "").trim();
  const oldAmount = Number(existing.amount) || 0;
  const oldNote = String(existing.note || "");
  const delta = Math.round((newAmount - oldAmount) * 100) / 100;

  // Keep the wallet consistent: reducing a funding entry must not drive the
  // available balance negative when that money was already spent.
  if (delta !== 0) {
    await ensureFund();
    const funds = await getCollection("officeExpenseFund");
    if (delta > 0) {
      const updated = await funds.findOneAndUpdate(
        { _id: FUND_ID },
        { $inc: { balance: delta, totalFunded: delta }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!updated) {
        const err = new Error("Wallet fund not found.");
        err.code = "NOT_FOUND";
        throw err;
      }
    } else {
      const updated = await funds.findOneAndUpdate(
        { _id: FUND_ID, balance: { $gte: Math.abs(delta) } },
        { $inc: { balance: delta, totalFunded: delta }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      const fund = mapFundResult(updated);
      if (!fund) {
        const current = await ensureFund();
        const err = new Error(
          `Insufficient available balance to reduce this entry. Available: ৳${Number(current.balance || 0).toLocaleString()}, reduction needed: ৳${Math.abs(delta).toLocaleString()}.`,
        );
        err.code = "INSUFFICIENT_BALANCE";
        err.available = Number(current.balance || 0);
        throw err;
      }
    }
  }

  const editedBy = normalizeEditedBy(actor);
  const historyEntry = {
    oldAmount,
    newAmount,
    oldNote,
    newNote,
    editNote: reason,
    editedBy,
    editedAt: new Date(),
  };

  await txns.updateOne(filter, {
    $set: { amount: newAmount, note: newNote, updatedAt: new Date(), lastEditedBy: editedBy, lastEditNote: reason },
    $push: { editHistory: historyEntry },
  });
  const saved = await txns.findOne(filter);
  logger.info(`updateFundTransaction: edited ${existing.type} txn ${id} (${oldAmount} -> ${newAmount}).`);
  return { fund: await getFund(), transaction: mapTxn(saved) };
}

/**
 * Delete an "Ad Money History" funding transaction and roll its amount back
 * out of the wallet balance/totalFunded.
 */
export async function deleteFundTransaction(id) {
  const filter = await resolveTxnFilter(id);
  if (!filter) {
    const err = new Error("Transaction id is required.");
    err.code = "NOT_FOUND";
    throw err;
  }
  const txns = await getCollection("officeExpenseFundTransactions");
  const existing = await txns.findOne(filter);
  if (!existing) {
    const err = new Error("Ad money entry not found.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!ADD_TYPES_SAFE.includes(existing.type)) {
    const err = new Error("Only Ad Money entries can be deleted from the wallet.");
    err.code = "NOT_EDITABLE";
    throw err;
  }
  const amt = Number(existing.amount) || 0;
  if (amt > 0) {
    await ensureFund();
    const funds = await getCollection("officeExpenseFund");
    const updated = await funds.findOneAndUpdate(
      { _id: FUND_ID, balance: { $gte: amt } },
      { $inc: { balance: -amt, totalFunded: -amt }, $set: { updatedAt: new Date() } },
      { returnDocument: "after" },
    );
    const fund = mapFundResult(updated);
    if (!fund) {
      const current = await ensureFund();
      const err = new Error(
        `Insufficient available balance to delete this entry. Available: ৳${Number(current.balance || 0).toLocaleString()}, entry amount: ৳${amt.toLocaleString()}.`,
      );
      err.code = "INSUFFICIENT_BALANCE";
      err.available = Number(current.balance || 0);
      throw err;
    }
  }
  await txns.deleteOne(filter);
  logger.info(`deleteFundTransaction: removed ${existing.type} txn ${id} (amount ${amt}).`);
  return { fund: await getFund(), transaction: mapTxn(existing) };
}

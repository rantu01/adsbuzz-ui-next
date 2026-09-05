import { getCollection } from "@/lib/db";
import logger from "@/utils/logger";

const FUND_ID = "main";
const TXN_TYPES = ["opening", "fund", "expense", "expense_adjust", "expense_reversal"];

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

async function recordTransaction(txn) {
  const collection = await getCollection("officeExpenseFundTransactions");
  const type = TXN_TYPES.includes(txn.type) ? txn.type : "fund";
  const doc = {
    type,
    amount: toNumber(txn.amount),
    month: String(txn.month || ""),
    voucherNo: String(txn.voucherNo || ""),
    entryId: String(txn.entryId || ""),
    note: String(txn.note || ""),
    createdAt: new Date(),
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

export async function addFunds({ amount, note = "", month = "" } = {}) {
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
  await recordTransaction({ type: "fund", amount: amt, month, note });
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

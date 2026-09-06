import { getCollection, getDb } from "@/lib/db";
import logger from "@/utils/logger";
import { INITIAL_OFFICE_EXPENSE_ENTRIES } from "@/data/seedData";
import { listOfficeExpenses } from "@/models/officeExpenseModel";
import { listOfficeExpenseMonths } from "@/models/officeExpenseMonthModel";
import {
  deductForExpense,
  adjustForExpenseUpdate,
  refundForExpenseDelete,
  getFund,
} from "@/models/officeExpenseFundModel";

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Voucher numbers are auto-generated as ADBOE200000001, ADBOE200000002, ...
// i.e. prefix "ADBOE2" followed by an 8-digit zero-padded sequence.
const VOUCHER_PREFIX = "ADBOE2";
const VOUCHER_SEQ_WIDTH = 8;
const VOUCHER_COUNTER_ID = "officeExpenseVoucherSeq";

function formatVoucherNo(seq) {
  return `${VOUCHER_PREFIX}${String(seq).padStart(VOUCHER_SEQ_WIDTH, "0")}`;
}

function parseVoucherSeq(voucherNo) {
  const m = /^ADBOE2(\d+)$/.exec(String(voucherNo || "").trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

async function getMaxPersistedVoucherSeq() {
  const collection = await getCollection("officeExpenseEntries");
  const docs = await collection
    .find({ voucherNo: { $regex: "^ADBOE2\\d+$" } }, { projection: { voucherNo: 1 } })
    .toArray();
  let max = 0;
  for (const d of docs) {
    const s = parseVoucherSeq(d.voucherNo);
    if (s > max) max = s;
  }
  return max;
}

// Peek the next voucher number WITHOUT consuming the counter. Used for the
// entry-form preview; the authoritative number is assigned on create.
export async function peekNextOfficeExpenseVoucherNo() {
  const max = await getMaxPersistedVoucherSeq();
  const db = await getDb();
  const counter = await db.collection("counters").findOne({ _id: VOUCHER_COUNTER_ID });
  const stored = Number(counter?.seq || 0);
  const next = Math.max(max, stored) + 1;
  return formatVoucherNo(Math.max(next, 1));
}

async function getNextOfficeExpenseVoucherNo() {
  const max = await getMaxPersistedVoucherSeq();
  const db = await getDb();
  const counters = db.collection("counters");
  const existing = await counters.findOne({ _id: VOUCHER_COUNTER_ID });
  if (!existing) {
    try {
      await counters.insertOne({ _id: VOUCHER_COUNTER_ID, seq: max });
    } catch {
      // Another request won the race; fall through to the atomic increment.
    }
  } else if (Number(existing.seq || 0) < max) {
    await counters.updateOne({ _id: VOUCHER_COUNTER_ID }, { $set: { seq: max } });
  }
  const result = await counters.findOneAndUpdate(
    { _id: VOUCHER_COUNTER_ID },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  );
  const doc = result?.value || result;
  let seq = Number(doc?.seq);
  if (!Number.isFinite(seq) || seq <= 0) {
    const fresh = await counters.findOne({ _id: VOUCHER_COUNTER_ID });
    seq = Number(fresh?.seq || max + 1);
  }
  if (seq <= max) {
    await counters.updateOne({ _id: VOUCHER_COUNTER_ID }, { $set: { seq: max + 1 } });
    seq = max + 1;
  }
  return formatVoucherNo(seq);
}

// A date belongs to a "future month" when its YYYY-MM is after the current
// YYYY-MM. Days within the current (already started) month are allowed.
function getInputYearMonth(input) {
  if (typeof input === "string") {
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?/.exec(input.trim());
    if (m) return { y: Number(m[1]), m: Number(m[2]) };
  }
  const d = input instanceof Date ? input : new Date(input);
  if (!d || Number.isNaN(d.getTime())) return null;
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function isFutureMonthInput(dateInput, now = new Date()) {
  if (dateInput == null || dateInput === "") return false;
  const ym = getInputYearMonth(dateInput);
  if (!ym) return false;
  const ny = now.getFullYear();
  const nm = now.getMonth() + 1;
  return ym.y > ny || (ym.y === ny && ym.m > nm);
}

function sanitize(input = {}) {
  const month = String(input.month || "").trim();
  const voucherNo = String(input.voucherNo || "").trim();
  const category = String(input.category || "").trim();
  const subCategory = String(input.subCategory || "").trim();
  const description = String(input.description || "").trim();
  const amount = toNumber(input.amount);
  let date = null;
  if (input.date) {
    const parsed = new Date(input.date);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }
  return { month, voucherNo, category, subCategory, description, amount, date };
}

// ---------------------------------------------------------------------------
// Multi-level approval system (mirrors the Topup audit workflow).
// Flow: Staff creates Entry (Pending Approval) → 2–3 assigned staff approve
// (initial approvals) → final approver grants Final Approval → Approved.
// Only the final approval deducts the amount from Cash In Hand (fund).
// Statuses: Pending Approval | Approved | Review Need | Rejected.
// ---------------------------------------------------------------------------
export const EXPENSE_APPROVAL_STATUSES = ["Pending Approval", "Approved", "Review Need", "Rejected"];
export const DEFAULT_REQUIRED_APPROVALS = 3; // 2 staff initials + 1 final approval
const APPROVAL_SETTINGS_ID = "main";

function normalizeActor(actor) {
  if (!actor) return null;
  if (typeof actor === "string") {
    const v = actor.trim();
    return v ? { name: v } : null;
  }
  const uid = actor.uid != null ? String(actor.uid) : "";
  const name = actor.name != null ? String(actor.name) : "";
  const email = actor.email != null ? String(actor.email) : "";
  if (!uid && !name && !email) return null;
  return { ...(uid ? { uid } : {}), ...(name ? { name } : {}), ...(email ? { email } : {}) };
}

function actorKey(actor) {
  if (!actor) return "";
  return String(actor.uid || actor.email || actor.name || "").trim().toLowerCase();
}

function approvalLogEntry(action, status, { actor = null, note = "" } = {}) {
  return {
    action: String(action || "created"),
    status: String(status || "Pending Approval"),
    actor: normalizeActor(actor),
    note: String(note || ""),
    at: new Date().toISOString(),
  };
}

export async function getOfficeExpenseApprovalSettings() {
  const collection = await getCollection("officeExpenseApprovalSettings");
  const existing = await collection.findOne({ _id: APPROVAL_SETTINGS_ID });
  if (existing) {
    const { _id, ...rest } = existing;
    return {
      id: APPROVAL_SETTINGS_ID,
      requiredApprovals: Math.max(1, Math.min(Number(rest.requiredApprovals) || DEFAULT_REQUIRED_APPROVALS, 10)),
      approvers: Array.isArray(rest.approvers) ? rest.approvers : [],
      updatedAt: rest.updatedAt || null,
    };
  }
  return { id: APPROVAL_SETTINGS_ID, requiredApprovals: DEFAULT_REQUIRED_APPROVALS, approvers: [], updatedAt: null };
}

export async function updateOfficeExpenseApprovalSettings({ requiredApprovals, approvers } = {}) {
  const collection = await getCollection("officeExpenseApprovalSettings");
  const patch = { updatedAt: new Date() };
  if (requiredApprovals !== undefined) {
    const n = Number(requiredApprovals);
    if (!Number.isFinite(n) || n < 1 || n > 10) throw new Error("INVALID_REQUIRED_APPROVALS");
    patch.requiredApprovals = Math.floor(n);
  }
  if (approvers !== undefined) {
    const list = Array.isArray(approvers) ? approvers : String(approvers || "").split(/[\n,]+/);
    patch.approvers = [...new Set(list.map((a) => String(a || "").trim()).filter(Boolean))].slice(0, 10);
  }
  await collection.updateOne({ _id: APPROVAL_SETTINGS_ID }, { $set: patch }, { upsert: true });
  return getOfficeExpenseApprovalSettings();
}

function normalizeApprovalEntry(doc) {
  const status = EXPENSE_APPROVAL_STATUSES.includes(doc?.approvalStatus) ? doc.approvalStatus : "Approved";
  const requiredApprovals =
    Number.isFinite(Number(doc?.requiredApprovals)) && Number(doc.requiredApprovals) > 0
      ? Number(doc.requiredApprovals)
      : status === "Approved"
        ? 0
        : DEFAULT_REQUIRED_APPROVALS;
  const approvals = Array.isArray(doc?.approvals) ? doc.approvals : [];
  const logs = Array.isArray(doc?.approvalLogs) ? doc.approvalLogs : Array.isArray(doc?.auditLog) ? doc.auditLog : [];
  const done = status === "Approved" ? requiredApprovals : approvals.length;
  const pendingApprovals = status === "Approved" ? 0 : Math.max(0, requiredApprovals - done);
  return { approvalStatus: status, requiredApprovals, approvals, approvalLogs: logs, pendingApprovals };
}

export function mapOfficeExpenseEntry(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  const norm = normalizeApprovalEntry({ ...rest, approvalStatus: rest.approvalStatus });
  // Legacy documents without approval fields count as already Approved so
  // historical totals, balances and dashboard aggregates keep working.
  return { ...rest, ...norm, id: _id.toString() };
}

async function findEntryOrNull(id) {
  const collection = await getCollection("officeExpenseEntries");
  let doc = null;
  try {
    const { ObjectId } = await import("mongodb");
    doc = await collection.findOne({ _id: new ObjectId(id) });
  } catch {
    doc = null;
  }
  return doc;
}

export async function seedOfficeExpenseEntries() {
  const collection = await getCollection("officeExpenseEntries");
  const count = await collection.countDocuments();
  if (count > 0) {
    // Backfill approval fields on legacy documents so every entry carries a
    // complete approval state (historical rows count as already Approved).
    await collection.updateMany(
      { approvalStatus: { $exists: false } },
      {
        $set: {
          approvalStatus: "Approved",
          requiredApprovals: 0,
          approvals: [],
          updatedAt: new Date(),
        },
      },
    );
    await collection.updateMany(
      { approvalLogs: { $exists: false } },
      {
        $set: {
          approvalLogs: [
            { action: "created", status: "Approved", actor: null, note: "Migrated historical entry.", at: new Date().toISOString() },
          ],
        },
      },
    );
    return { seeded: 0 };
  }

  const now = new Date();
  const docs = INITIAL_OFFICE_EXPENSE_ENTRIES.map((e) => {
    const s = sanitize(e);
    return {
      ...s,
      approvalStatus: "Approved",
      requiredApprovals: 0,
      approvals: [],
      approvalLogs: [
        { action: "created", status: "Approved", actor: null, note: "Seeded historical entry.", at: now.toISOString() },
      ],
      createdAt: now,
      updatedAt: now,
    };
  });
  if (docs.length > 0) await collection.insertMany(docs);
  logger.info(`seedOfficeExpenseEntries: seeded ${docs.length} office expense entries.`);
  return { seeded: docs.length };
}

export async function listOfficeExpenseEntries({ month = "", category = "", search = "", status = "", date = "" } = {}) {
  await seedOfficeExpenseEntries();
  const collection = await getCollection("officeExpenseEntries");
  const filter = {};
  if (month) filter.month = month;
  if (category) filter.category = category;
  if (status && EXPENSE_APPROVAL_STATUSES.includes(status)) filter.approvalStatus = status;
  if (date) {
    const day = String(date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      const start = new Date(`${day}T00:00:00.000Z`);
      const end = new Date(`${day}T23:59:59.999Z`);
      if (!Number.isNaN(start.getTime())) filter.date = { $gte: start, $lte: end };
    }
  }
  if (search) {
    const q = search.toLowerCase();
    filter.$or = [
      { voucherNo: { $regex: q, $options: "i" } },
      { category: { $regex: q, $options: "i" } },
      { subCategory: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
    ];
  }
  const items = await collection.find(filter).sort({ date: -1, voucherNo: 1 }).toArray();
  return items.map((doc) => mapOfficeExpenseEntry(doc));
}

export async function getOfficeExpenseEntryById(id) {
  await seedOfficeExpenseEntries();
  const doc = await findEntryOrNull(id);
  if (!doc) return null;
  return mapOfficeExpenseEntry(doc);
}

export async function createOfficeExpenseEntry(data) {
  const collection = await getCollection("officeExpenseEntries");
  // Never trust a client-supplied voucher number or a future-month date:
  // both are enforced here so the API cannot be bypassed.
  if (isFutureMonthInput(data?.date)) throw new Error("FUTURE_MONTH_DATE");
  const s = sanitize(data);
  if (!s.month) throw new Error("MONTH_REQUIRED");
  if (!s.category) throw new Error("CATEGORY_REQUIRED");
  if (s.date && isFutureMonthInput(s.date)) throw new Error("FUTURE_MONTH_DATE");

  // Voucher numbers are always auto-generated sequentially.
  s.voucherNo = await getNextOfficeExpenseVoucherNo();
  // New entries always start as Pending Approval and NEVER touch the fund
  // balance — the amount is deducted only when the final approval completes.
  let requiredApprovals = DEFAULT_REQUIRED_APPROVALS;
  try {
    const settings = await getOfficeExpenseApprovalSettings();
    if (Number.isFinite(Number(settings?.requiredApprovals))) {
      requiredApprovals = Math.max(1, Math.min(Number(settings.requiredApprovals), 10));
    }
  } catch {
    // fall back to the default when settings are unavailable
  }
  const actor = normalizeActor(data?.createdBy || data?.actor || null);
  const doc = {
    ...s,
    approvalStatus: "Pending Approval",
    requiredApprovals,
    approvals: [],
    approvalLogs: [approvalLogEntry("created", "Pending Approval", { actor })],
    ...(actor ? { createdBy: actor } : {}),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    await collection.insertOne(doc);
  } catch (err) {
    // Retry once on a duplicate voucher caused by a concurrent insert.
    if (err?.code === 11000 && /voucher/i.test(err?.message || "")) {
      s.voucherNo = await getNextOfficeExpenseVoucherNo();
      doc.voucherNo = s.voucherNo;
      await collection.insertOne(doc);
    } else {
      throw err;
    }
  }
  const entry = mapOfficeExpenseEntry(doc);
  logger.info(`createOfficeExpenseEntry: voucher ${entry.voucherNo} created (Pending Approval, ${requiredApprovals} approvals required).`);
  return entry;
}

export async function updateOfficeExpenseEntry(id, data) {
  const collection = await getCollection("officeExpenseEntries");
  const existing = await findEntryOrNull(id);
  if (!existing) return null;

  // Voucher numbers are auto-generated and immutable; date must never fall
  // in a future (not-yet-started) month, even via direct API calls.
  if ("date" in data && isFutureMonthInput(data.date)) throw new Error("FUTURE_MONTH_DATE");
  const s = sanitize(data);
  if (s.date && isFutureMonthInput(s.date)) throw new Error("FUTURE_MONTH_DATE");
  const patch = { updatedAt: new Date() };
  if (s.month) patch.month = s.month;
  if (s.category) patch.category = s.category;
  if (typeof s.subCategory === "string") patch.subCategory = s.subCategory;
  if (typeof s.description === "string") patch.description = s.description;
  if (data.amount !== undefined) patch.amount = s.amount;
  if ("date" in data) patch.date = s.date;

  const wasApproved = (existing.approvalStatus || "Approved") === "Approved";
  const oldAmount = Number(existing.amount) || 0;
  const newAmount = data.amount !== undefined ? s.amount : oldAmount;
  const newMonth = s.month || existing.month;
  const newVoucher = existing.voucherNo;
  const delta = Math.round((newAmount - oldAmount) * 100) / 100;

  await collection.updateOne({ _id: existing._id }, { $set: patch });

  // Only Approved entries have touched the fund balance, so only amount
  // changes on Approved entries adjust it. Pending / Review / Rejected
  // entries never deduct, so editing them is fund-neutral.
  if (wasApproved && delta !== 0) {
    try {
      await adjustForExpenseUpdate({
        entryId: existing._id.toString(),
        month: newMonth,
        voucherNo: newVoucher,
        oldAmount,
        newAmount,
      });
    } catch (err) {
      await collection.updateOne(
        { _id: existing._id },
        {
          $set: {
            month: existing.month,
            voucherNo: existing.voucherNo,
            category: existing.category,
            subCategory: existing.subCategory,
            description: existing.description,
            amount: existing.amount,
            date: existing.date,
            updatedAt: new Date(),
          },
        },
      );
      throw err;
    }
  }

  const updated = await collection.findOne({ _id: existing._id });
  return mapOfficeExpenseEntry(updated);
}

export async function deleteOfficeExpenseEntry(id) {
  const collection = await getCollection("officeExpenseEntries");
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  await collection.deleteOne({ _id: existing._id });
  // Only Approved entries ever deducted from the fund — refund those.
  // Removing a pending/review/rejected entry is fund-neutral.
  if ((existing.approvalStatus || "Approved") === "Approved") {
    await refundForExpenseDelete({
      entryId: existing._id.toString(),
      month: existing.month,
      voucherNo: existing.voucherNo,
      amount: Number(existing.amount) || 0,
    });
  }
  return mapOfficeExpenseEntry(existing);
}

// ---------------------------------------------------------------------------
// Approval transitions. Every transition appends to `approvalLogs` (the
// complete approval history, like the Topup audit log).
// ---------------------------------------------------------------------------
async function applyApprovalTransition(id, { action, status, actor = null, note = "", extra = {} }) {
  const collection = await getCollection("officeExpenseEntries");
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  const norm = normalizeApprovalEntry(existing);
  await collection.updateOne(
    { _id: existing._id },
    {
      $set: { approvalStatus: status, updatedAt: new Date(), ...extra },
      $push: { approvalLogs: approvalLogEntry(action, status, { actor, note }) },
    },
  );
  const updated = await collection.findOne({ _id: existing._id });
  return { updated: mapOfficeExpenseEntry(updated), previous: mapOfficeExpenseEntry(existing), prevNorm: norm };
}

/** Staff initial approval. Stays Pending Approval until initials are done. */
export async function approveOfficeExpenseEntry(id, { actor = null, note = "" } = {}) {
  const collection = await getCollection("officeExpenseEntries");
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  const norm = normalizeApprovalEntry(existing);
  if (norm.approvalStatus === "Approved") {
    const err = new Error("Entry is already approved.");
    err.code = "ALREADY_APPROVED";
    throw err;
  }
  if (norm.approvalStatus === "Rejected") {
    const err = new Error("Entry was rejected. It cannot be approved unless it is resubmitted.");
    err.code = "ENTRY_REJECTED";
    throw err;
  }
  const required = norm.requiredApprovals || DEFAULT_REQUIRED_APPROVALS;
  const initialsNeeded = Math.max(1, required - 1);
  const me = normalizeActor(actor);
  const key = actorKey(me);
  if (key && norm.approvals.some((a) => actorKey(a?.actor) === key)) {
    const err = new Error("You have already approved this entry.");
    err.code = "DUPLICATE_APPROVAL";
    throw err;
  }
  if (norm.approvals.length >= initialsNeeded) {
    const err = new Error("Initial approvals are complete. Final approval is required.");
    err.code = "AWAITING_FINAL_APPROVAL";
    throw err;
  }
  const approval = { actor: me, note: String(note || ""), at: new Date().toISOString() };
  await collection.updateOne(
    { _id: existing._id },
    {
      $set: { approvalStatus: "Pending Approval", updatedAt: new Date() },
      $push: {
        approvals: approval,
        approvalLogs: approvalLogEntry("approved", "Pending Approval", { actor: me, note }),
      },
    },
  );
  const updated = await collection.findOne({ _id: existing._id });
  logger.info(`approveOfficeExpenseEntry: ${existing.voucherNo} approved by ${key || "staff"} (${norm.approvals.length + 1}/${required}).`);
  return mapOfficeExpenseEntry(updated);
}

/** Final approval — only when initials are complete. Deducts Cash In Hand. */
export async function finalApproveOfficeExpenseEntry(id, { actor = null, note = "" } = {}) {
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  const norm = normalizeApprovalEntry(existing);
  if (norm.approvalStatus === "Approved") {
    const err = new Error("Entry is already approved.");
    err.code = "ALREADY_APPROVED";
    throw err;
  }
  if (norm.approvalStatus === "Rejected") {
    const err = new Error("Entry was rejected. It cannot be approved unless it is resubmitted.");
    err.code = "ENTRY_REJECTED";
    throw err;
  }
  const required = norm.requiredApprovals || DEFAULT_REQUIRED_APPROVALS;
  const initialsNeeded = Math.max(1, required - 1);
  if (norm.approvals.length < initialsNeeded) {
    const err = new Error(
      `Initial approvals incomplete (${norm.approvals.length}/${initialsNeeded} done). ${required - norm.approvals.length} approval(s) still pending.`,
    );
    err.code = "INITIALS_INCOMPLETE";
    err.pending = required - norm.approvals.length;
    throw err;
  }
  const me = normalizeActor(actor);
  const key = actorKey(me);
  if (key && norm.approvals.some((a) => actorKey(a) === key)) {
    const err = new Error("You have already approved this entry at an earlier step.");
    err.code = "DUPLICATE_APPROVAL";
    throw err;
  }
  const collection = await getCollection("officeExpenseEntries");
  const approval = { actor: me, note: String(note || ""), at: new Date().toISOString(), final: true };
  await collection.updateOne(
    { _id: existing._id },
    {
      $set: { approvalStatus: "Approved", updatedAt: new Date() },
      $push: {
        approvals: approval,
        approvalLogs: approvalLogEntry("final_approved", "Approved", { actor: me, note }),
      },
    },
  );
  // The amount leaves Cash In Hand only now. Insufficient funds roll the
  // entry back to Pending Approval so no un-funded expense is recorded.
  try {
    await deductForExpense({
      amount: Number(existing.amount) || 0,
      entryId: existing._id.toString(),
      month: existing.month,
      voucherNo: existing.voucherNo,
      note: existing.description,
    });
  } catch (err) {
    await collection.updateOne(
      { _id: existing._id },
      {
        $set: { approvalStatus: "Pending Approval", updatedAt: new Date() },
        $pull: { approvals: approval },
        $push: {
          approvalLogs: approvalLogEntry("final_approve_failed", "Pending Approval", {
            actor: me,
            note: err?.message || "Insufficient balance.",
          }),
        },
      },
    );
    throw err;
  }
  const updated = await collection.findOne({ _id: existing._id });
  logger.info(`finalApproveOfficeExpenseEntry: ${existing.voucherNo} finally approved (৳${Number(existing.amount) || 0} deducted).`);
  return mapOfficeExpenseEntry(updated);
}

function requireApprovalNote(note) {
  if (!String(note || "").trim()) {
    const err = new Error("A note/reason is required for this status change.");
    err.code = "NOTE_REQUIRED";
    throw err;
  }
}

/** Mark Review Need — note mandatory. Keeps existing approvals. */
export async function reviewOfficeExpenseEntry(id, { actor = null, note = "" } = {}) {
  requireApprovalNote(note);
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  const norm = normalizeApprovalEntry(existing);
  if (norm.approvalStatus === "Approved") {
    const err = new Error("Entry is already approved and cannot be sent for review.");
    err.code = "ALREADY_APPROVED";
    throw err;
  }
  const { updated } = await applyApprovalTransition(id, { action: "review_requested", status: "Review Need", actor, note });
  logger.info(`reviewOfficeExpenseEntry: ${existing.voucherNo} marked Review Need.`);
  return updated;
}

/** Reject — note mandatory. Never deducts; refunds if it was Approved. */
export async function rejectOfficeExpenseEntry(id, { actor = null, note = "" } = {}) {
  requireApprovalNote(note);
  const existing = await findEntryOrNull(id);
  if (!existing) return null;
  const wasApproved = (existing.approvalStatus || "") === "Approved";
  const { updated } = await applyApprovalTransition(id, { action: "rejected", status: "Rejected", actor, note });
  if (wasApproved) {
    await refundForExpenseDelete({
      entryId: existing._id.toString(),
      month: existing.month,
      voucherNo: existing.voucherNo,
      amount: Number(existing.amount) || 0,
    });
  }
  logger.info(`rejectOfficeExpenseEntry: ${existing.voucherNo} rejected.`);
  return updated;
}

/**
 * Aggregate office-expense data for the dashboard, computed from the stored
 * entry + month collections (mirrors the AdsBuzz LLC Accounts Dashboard CSV).
 */
export async function getOfficeExpenseDashboard(year) {
  await seedOfficeExpenseEntries();

  const collection = await getCollection("officeExpenseEntries");
  const rawEntries = await collection.find({}).toArray();
  // Only Approved expenses contribute to dashboard totals — pending, review
  // and rejected entries must not inflate reported spend. Legacy documents
  // without an approval status count as Approved.
  const allEntries = rawEntries.filter((e) => (e.approvalStatus || "Approved") === "Approved");

  const years = [...new Set(allEntries.map((e) => String(e.month || "").slice(0, 4)))].filter(Boolean).sort();

  const targetYear = year && years.includes(String(year)) ? String(year) : years[years.length - 1];
  const entries = targetYear ? allEntries.filter((e) => String(e.month || "").startsWith(targetYear)) : [];

  const months = [...new Set(entries.map((e) => e.month))].sort();

  const categoriesDoc = await listOfficeExpenses();
  const categories = (categoriesDoc || []).map((c) => c.mainCategory);

  const matrix = {};
  const monthTotals = {};
  const categoryTotals = {};
  categories.forEach((c) => {
    matrix[c] = {};
    months.forEach((m) => (matrix[c][m] = 0));
    categoryTotals[c] = 0;
  });
  months.forEach((m) => (monthTotals[m] = 0));

  entries.forEach((e) => {
    const cat = e.category;
    const m = e.month;
    const amt = Number(e.amount) || 0;
    if (!(cat in matrix)) {
      matrix[cat] = {};
      months.forEach((mm) => (matrix[cat][mm] = 0));
      categoryTotals[cat] = 0;
    }
    if (!(m in matrix[cat])) matrix[cat][m] = 0;
    matrix[cat][m] += amt;
    monthTotals[m] = (monthTotals[m] || 0) + amt;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });

  const yearTotal = Object.values(monthTotals).reduce((a, b) => a + b, 0);

  const monthsMeta = await listOfficeExpenseMonths();
  const cashInHand = {};
  monthsMeta.forEach((meta) => {
    if (months.includes(meta.month)) cashInHand[meta.month] = meta.cashInHand || 0;
  });

  return {
    year: targetYear || null,
    years,
    months,
    categories,
    matrix,
    monthTotals,
    categoryTotals,
    yearTotal,
    cashInHand,
    totalEntries: entries.length,
  };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Matches the application's "valid expense" rule: Approved entries only,
// with legacy documents lacking an approval status counted as Approved.
function approvedMatch() {
  return {
    $or: [{ approvalStatus: "Approved" }, { approvalStatus: { $exists: false } }, { approvalStatus: null }],
  };
}

function withPct(categories, total) {
  return categories.map((c) => ({
    ...c,
    total: round2(c.total),
    pct: total > 0 ? Math.round((c.total / total) * 1000) / 10 : 0,
  }));
}

/**
 * Single server-side aggregation powering the Office Expense Dashboard.
 * Everything (lifetime, yearly, monthly, approval counts, cash in hand) is
 * computed in the database via one $facet pipeline + one fund lookup, so the
 * browser never loads individual expense records.
 */
export async function getOfficeExpenseOverview() {
  await seedOfficeExpenseEntries();
  const collection = await getCollection("officeExpenseEntries");

  const monthOk = { month: { $regex: "^\\d{4}-\\d{2}$" } };
  const yearOf = { $substrCP: ["$month", 0, 4] };

  const [facets] = await collection
    .aggregate([
      {
        $facet: {
          lifetime: [
            { $match: { ...monthOk, ...approvedMatch() } },
            { $group: { _id: null, total: { $sum: "$amount" }, vouchers: { $sum: 1 } } },
          ],
          lifetimeMonths: [
            { $match: { ...monthOk, ...approvedMatch() } },
            { $group: { _id: "$month" } },
            { $count: "n" },
          ],
          approvalCounts: [{ $group: { _id: { $ifNull: ["$approvalStatus", "Approved"] }, n: { $sum: 1 } } }],
          yearsAll: [{ $match: monthOk }, { $group: { _id: yearOf } }, { $sort: { _id: 1 } }],
          byYear: [
            { $match: { ...monthOk, ...approvedMatch() } },
            {
              $group: {
                _id: yearOf,
                total: { $sum: "$amount" },
                vouchers: { $sum: 1 },
                months: { $addToSet: "$month" },
              },
            },
            { $sort: { _id: 1 } },
          ],
          byYearCategory: [
            { $match: { ...monthOk, ...approvedMatch() } },
            {
              $group: {
                _id: { y: yearOf, c: "$category" },
                total: { $sum: "$amount" },
                entries: { $sum: 1 },
              },
            },
            { $sort: { "_id.y": 1, total: -1 } },
          ],
          byMonth: [
            { $match: { ...monthOk, ...approvedMatch() } },
            { $group: { _id: "$month", total: { $sum: "$amount" }, entries: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          byMonthCategory: [
            { $match: { ...monthOk, ...approvedMatch() } },
            {
              $group: {
                _id: { m: "$month", c: "$category" },
                total: { $sum: "$amount" },
                entries: { $sum: 1 },
              },
            },
            { $sort: { "_id.m": 1, total: -1 } },
          ],
        },
      },
    ])
    .toArray();

  const f = facets || {};
  const lifetimeDoc = (f.lifetime || [])[0] || { total: 0, vouchers: 0 };
  const lifetime = { total: round2(lifetimeDoc.total), vouchers: lifetimeDoc.vouchers || 0 };
  const totalMonthsRecorded = ((f.lifetimeMonths || [])[0] || {}).n || 0;

  const counts = { pending: 0, approved: 0, rejected: 0, reviewNeed: 0, total: 0 };
  (f.approvalCounts || []).forEach((row) => {
    const n = row.n || 0;
    counts.total += n;
    if (row._id === "Pending Approval") counts.pending += n;
    else if (row._id === "Approved") counts.approved += n;
    else if (row._id === "Rejected") counts.rejected += n;
    else if (row._id === "Review Need") counts.reviewNeed += n;
  });

  const years = [...new Set((f.yearsAll || []).map((r) => String(r._id || "")))].filter(Boolean).sort();

  const catsByYear = {};
  (f.byYearCategory || []).forEach((row) => {
    const y = String(row._id?.y || "");
    if (!y) return;
    (catsByYear[y] = catsByYear[y] || []).push({
      category: row._id?.c || "Uncategorized",
      total: row.total || 0,
      entries: row.entries || 0,
    });
  });

  const catsByMonth = {};
  (f.byMonthCategory || []).forEach((row) => {
    const m = String(row._id?.m || "");
    if (!m) return;
    (catsByMonth[m] = catsByMonth[m] || []).push({
      category: row._id?.c || "Uncategorized",
      total: row.total || 0,
      entries: row.entries || 0,
    });
  });

  const byYear = {};
  (f.byYear || []).forEach((row) => {
    const y = String(row._id || "");
    if (!y) return;
    const total = round2(row.total);
    const months = [...new Set(row.months || [])].sort();
    byYear[y] = {
      total,
      vouchers: row.vouchers || 0,
      months,
      monthsRecorded: months.length,
      avgMonthly: months.length > 0 ? round2(total / months.length) : 0,
      categories: withPct(catsByYear[y] || [], total),
    };
  });

  const byMonth = {};
  (f.byMonth || []).forEach((row) => {
    const m = String(row._id || "");
    if (!m) return;
    const total = round2(row.total);
    byMonth[m] = {
      total,
      entries: row.entries || 0,
      categories: withPct(catsByMonth[m] || [], total),
    };
  });

  let cashInHand = 0;
  try {
    const fund = await getFund();
    cashInHand = round2(fund?.balance);
  } catch {
    cashInHand = 0;
  }

  return {
    cashInHand,
    lifetime,
    totalMonthsRecorded,
    approvalCounts: counts,
    years,
    byYear,
    byMonth,
  };
}

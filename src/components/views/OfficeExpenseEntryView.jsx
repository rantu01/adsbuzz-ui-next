'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Wallet,
  FileText,
  Banknote,
  History,
  Printer,
  CheckCheck,
  ThumbsUp,
  MessageSquare,
  XCircle,
  Settings2,
  ShieldCheck,
  AlertCircle,
  FileClock,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Pagination from '@/components/common/Pagination';
import { apiFetch } from '@/utils/api';

const ENTRY_PAGE_SIZE = 10;

// Voucher numbers are auto-generated as ADBOE200000001, ADBOE200000002, ...
const VOUCHER_PREFIX = 'ADBOE2';
const VOUCHER_SEQ_WIDTH = 8;

function parseVoucherSeq(voucherNo) {
  const m = /^ADBOE2(\d+)$/.exec(String(voucherNo || '').trim());
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

function getLocalNextVoucherNo(entries) {
  let max = 0;
  (entries || []).forEach((e) => {
    const s = parseVoucherSeq(e.voucherNo);
    if (s > max) max = s;
  });
  return `${VOUCHER_PREFIX}${String(max + 1 || 1).padStart(VOUCHER_SEQ_WIDTH, '0')}`;
}

// Last day of the current (already started) month in YYYY-MM-DD — used as the
// date picker's max so no future-month date can be picked.
function getMaxEntryDateStr(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// True when a YYYY-MM-DD value falls in a month that has not started yet.
function isFutureMonthDateStr(value, now = new Date()) {
  const m = /^(\d{4})-(\d{2})/.exec(String(value || '').trim());
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const ny = now.getFullYear();
  const nmo = now.getMonth() + 1;
  return y > ny || (y === ny && mo > nmo);
}

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US')}`;
}

function getCurrentMonthCode(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentMonthName(now = new Date()) {
  return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getEntryStatus(entry) {
  return entry?.approvalStatus || 'Approved';
}

function getRequiredApprovals(entry) {
  const n = Number(entry?.requiredApprovals);
  if (Number.isFinite(n) && n > 0) return n;
  return getEntryStatus(entry) === 'Approved' ? 0 : 3;
}

function getApprovalsDone(entry) {
  if (getEntryStatus(entry) === 'Approved') return getRequiredApprovals(entry);
  return Array.isArray(entry?.approvals) ? entry.approvals.length : 0;
}

function getPendingApprovals(entry) {
  if (getEntryStatus(entry) === 'Approved') return 0;
  return Math.max(0, getRequiredApprovals(entry) - getApprovalsDone(entry));
}

function pendingLabel(entry) {
  const n = getPendingApprovals(entry);
  return `${n} Approval${n === 1 ? '' : 's'} Pending`;
}

function statusTone(status) {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    case 'Review Need':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    case 'Rejected':
      return 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
    default:
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  }
}

function formatActor(actor) {
  if (!actor) return 'System';
  if (typeof actor === 'string') return actor;
  return actor.name || actor.email || actor.uid || 'System';
}

const LOG_ACTION_META = {
  created: { label: 'Entry Created', icon: <FileClock size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  approved: { label: 'Approved (staff)', icon: <ThumbsUp size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  final_approved: { label: 'Final Approval Granted', icon: <CheckCheck size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  review_requested: { label: 'Review Requested', icon: <MessageSquare size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  rejected: { label: 'Rejected', icon: <XCircle size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  final_approve_failed: { label: 'Final Approval Failed', icon: <AlertCircle size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
};

function OfficeExpenseEntryView({
  officeExpenses = [],
  officeExpenseEntries = [],
  officeExpenseEntriesError,
  officeExpenseMonths = [],
  officeExpenseFund = null,
  officeExpenseFundLoading = false,
  officeExpenseFundError = null,
  onRetryEntries,
  onRetryMonths,
  onRetryFund,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onApproveEntry,
  onFinalApproveEntry,
  onReviewEntry,
  onRejectEntry,
  onAddMonth,
}) {
  // The current month is always the default entry month — no manual
  // month setup needed. It is auto-created if it does not exist yet.
  const [selectedMonth, setSelectedMonth] = useState(() => getCurrentMonthCode());
  const [search, setSearch] = useState('');

  // Transaction filters (Month / Date / Category) above the table.
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [entryDate, setEntryDate] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [entryCategory, setEntryCategory] = useState('');
  const [entrySub, setEntrySub] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');

  const [pendingDelete, setPendingDelete] = useState(null);

  // Pagination state (entries table)
  const [entryPage, setEntryPage] = useState(1);

  const router = useRouter();

  // Approval workflow state
  const [busyKey, setBusyKey] = useState(null);
  const [noteTarget, setNoteTarget] = useState(null); // { entry, mode: 'review' | 'reject', note }
  const [logTarget, setLogTarget] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  // Approval settings (required approvals + assigned staff)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [requiredApprovals, setRequiredApprovals] = useState('3');
  const [approvers, setApprovers] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const categoryMap = useMemo(() => {
    const map = {};
    (officeExpenses || []).forEach((c) => {
      map[c.mainCategory] = c.subCategories || [];
    });
    return map;
  }, [officeExpenses]);

  const categoryOptions = useMemo(() => (officeExpenses || []).map((c) => c.mainCategory), [officeExpenses]);

  const monthOptions = useMemo(() => (officeExpenseMonths || []).map((m) => m.month), [officeExpenseMonths]);

  const currentMonthCode = useMemo(() => getCurrentMonthCode(), []);
  const currentMonthName = useMemo(() => getCurrentMonthName(), []);

  // Ensure the current month exists and stays selected by default.
  // When a new calendar month rolls over, its record is created on the fly
  // so staff never have to add months manually.
  const autoMonthTried = useRef(false);
  useEffect(() => {
    if (!officeExpenseMonths || officeExpenseMonths.length === 0) return;
    if (officeExpenseMonths.some((m) => m.month === currentMonthCode)) {
      setSelectedMonth(currentMonthCode);
      return;
    }
    if (!onAddMonth || autoMonthTried.current) return;
    autoMonthTried.current = true;
    onAddMonth({ month: currentMonthCode })
      .catch(() => {
        // Ignore races (e.g. duplicate creates) — selection still applies.
      })
      .finally(() => {
        setSelectedMonth(currentMonthCode);
      });
  }, [officeExpenseMonths, currentMonthCode, onAddMonth]);

  // Keep the table's month filter in sync with the header month selector
  // until the user picks a custom filter value.
  useEffect(() => {
    setFilterMonth((prev) => (prev === 'all' ? prev : selectedMonth || 'all'));
  }, [selectedMonth]);

  // ---- Summary boxes (current month) ----
  const currentMonthEntries = useMemo(
    () => (officeExpenseEntries || []).filter((e) => e.month === currentMonthCode),
    [officeExpenseEntries, currentMonthCode],
  );
  const currentMonthVoucherCount = currentMonthEntries.length;
  const currentMonthExpenseTotal = useMemo(
    () =>
      currentMonthEntries
        .filter((e) => getEntryStatus(e) === 'Approved')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [currentMonthEntries],
  );

  // ---- Filtered transaction list ----
  const filteredEntries = useMemo(
    () =>
      (officeExpenseEntries || [])
        .filter((e) => {
          if (filterMonth && filterMonth !== 'all' && e.month !== filterMonth) return false;
          if (filterDate && String(e.date || '').slice(0, 10) !== filterDate) return false;
          if (filterCategory && filterCategory !== 'all' && e.category !== filterCategory) return false;
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            (e.voucherNo || '').toLowerCase().includes(q) ||
            (e.category || '').toLowerCase().includes(q) ||
            (e.subCategory || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q)
          );
        }),
    [officeExpenseEntries, filterMonth, filterDate, filterCategory, search],
  );

  const filteredTotal = useMemo(
    () => filteredEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [filteredEntries],
  );

  // Reset to first page whenever the visible entry set changes.
  useEffect(() => {
    setEntryPage(1);
  }, [filterMonth, filterDate, filterCategory, search, officeExpenseEntries]);

  const entryTotalPages = Math.max(1, Math.ceil(filteredEntries.length / ENTRY_PAGE_SIZE));
  const safeEntryPage = Math.min(entryPage, entryTotalPages);
  const pagedEntries = useMemo(
    () => filteredEntries.slice((safeEntryPage - 1) * ENTRY_PAGE_SIZE, safeEntryPage * ENTRY_PAGE_SIZE),
    [filteredEntries, safeEntryPage],
  );

  const maxEntryDate = useMemo(() => getMaxEntryDateStr(), []);

  const runApprovalAction = async (key, fn) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
    } catch {
      // swallowed — the hook already toasted the failure
    } finally {
      setBusyKey(null);
    }
  };

  const handleEntryDateChange = (value) => {
    // Reject future-month dates even when typed manually into the field.
    if (value && isFutureMonthDateStr(value)) {
      setFormError('Date must not be in a future (not-yet-started) month.');
      return;
    }
    if (formError === 'Date must not be in a future (not-yet-started) month.') setFormError('');
    setEntryDate(value);
  };

  const openAddEntry = () => {
    setEditingEntry(null);
    setEntryDate('');
    // Auto-generated preview; the server assigns the authoritative number on save.
    setVoucherNo(getLocalNextVoucherNo(officeExpenseEntries));
    setEntryCategory(officeExpenses[0]?.mainCategory || '');
    setEntrySub('');
    setDescription('');
    setAmount('');
    setFormError('');
    setIsEntryModalOpen(true);
    // Refine the preview from the server counter without changing any other flow.
    apiFetch('/api/office-expense-entries/next-voucher')
      .then((data) => {
        if (data?.voucherNo) setVoucherNo(data.voucherNo);
      })
      .catch(() => {});
  };

  const openEditEntry = (entry) => {
    setEditingEntry(entry);
    setEntryDate(entry.date ? String(entry.date).slice(0, 10) : '');
    setVoucherNo(entry.voucherNo || '');
    setEntryCategory(entry.category || '');
    setEntrySub(entry.subCategory || '');
    setDescription(entry.description || '');
    setAmount(String(entry.amount || ''));
    setFormError('');
    setIsEntryModalOpen(true);
  };

  const handleSaveEntry = async () => {
    const cat = entryCategory.trim();
    if (!cat) {
      setFormError('Category is required.');
      return;
    }
    // Block any future-month date, including manually typed values that
    // bypass the date picker.
    if (entryDate && isFutureMonthDateStr(entryDate)) {
      setFormError('Date must not be in a future (not-yet-started) month.');
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) {
      setFormError('Amount must be a valid number.');
      return;
    }
    const payload = {
      month: selectedMonth,
      date: entryDate || null,
      voucherNo,
      category: cat,
      subCategory: entrySub,
      description,
      amount: amt,
    };
    try {
      if (editingEntry) {
        await onUpdateEntry({ ...editingEntry, ...payload });
      } else {
        await onAddEntry(payload);
      }
      setIsEntryModalOpen(false);
      setEditingEntry(null);
    } catch (err) {
      // Surface a clear inline message when the fund balance blocks the save;
      // other errors are already reported via toast by the data hooks.
      if (err?.details?.code === 'INSUFFICIENT_BALANCE' || /insufficient/i.test(err?.message || '')) {
        setFormError(err?.message || 'Insufficient available balance. Please add money first.');
      } else if (/future/i.test(err?.message || '')) {
        setFormError('Date must not be in a future (not-yet-started) month.');
      }
    }
  };

  const handleDeleteEntry = async () => {
    if (!pendingDelete) return;
    try {
      await onDeleteEntry(pendingDelete.id);
    } catch {
      // toast already shown
    } finally {
      setPendingDelete(null);
    }
  };

  const handleApprove = (entry) => {
    if (!onApproveEntry) return;
    runApprovalAction(`approve-${entry.id}`, () => onApproveEntry(entry.id));
  };

  const handleFinalApprove = (entry) => {
    if (!onFinalApproveEntry) return;
    runApprovalAction(`final-approve-${entry.id}`, () => onFinalApproveEntry(entry.id));
  };

  const openNoteModal = (entry, mode) => {
    setNoteTarget({ entry, mode, note: '' });
  };

  const submitNoteModal = async () => {
    if (!noteTarget || !String(noteTarget.note || '').trim()) return;
    const { entry, mode, note } = noteTarget;
    const key = `${mode}-${entry.id}`;
    await runApprovalAction(key, async () => {
      if (mode === 'review') {
        await onReviewEntry(entry.id, note.trim());
      } else {
        await onRejectEntry(entry.id, note.trim());
      }
      setNoteTarget(null);
    });
  };

  const openSettings = async () => {
    setSettingsError('');
    setIsSettingsOpen(true);
    try {
      const data = await apiFetch('/api/office-expense-approval-settings');
      if (data?.settings) {
        setRequiredApprovals(String(data.settings.requiredApprovals || 3));
        setApprovers((data.settings.approvers || []).join(', '));
      }
    } catch {
      // keep defaults; toast is not critical here
    }
  };

  const handleSaveSettings = async () => {
    const n = Number(requiredApprovals);
    if (!Number.isFinite(n) || n < 1 || n > 10) {
      setSettingsError('Required approvals must be a number between 1 and 10.');
      return;
    }
    setSettingsSaving(true);
    setSettingsError('');
    try {
      await apiFetch('/api/office-expense-approval-settings', {
        method: 'PATCH',
        body: JSON.stringify({ requiredApprovals: Math.floor(n), approvers }),
      });
      setIsSettingsOpen(false);
    } catch (err) {
      setSettingsError(err?.message || 'Failed to save approval settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterMonth('all');
    setFilterDate('');
    setFilterCategory('all');
    setSearch('');
  };

  const handlePrint = () => {
    window.print();
  };

  const approvalLogsOf = (entry) => (Array.isArray(entry?.approvalLogs) ? entry.approvalLogs : []);

  const initialsNeededOf = (entry) => Math.max(1, getRequiredApprovals(entry) - 1);
  const initialsCompleteOf = (entry) => getApprovalsDone(entry) >= initialsNeededOf(entry);

  const selectClass =
    'text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700';

  return (
    <div className="space-y-6 animate-fade-in">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #voucher-print-area, #voucher-print-area * { visibility: visible !important; }
        #voucher-print-area { position: absolute !important; left: 0; top: 0; width: 100% !important; }
      }`}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt size={22} className="text-brand-orange" />
            Monthly Data Entry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record office expense vouchers per month. New entries need multi-level approval before the amount leaves Cash In Hand.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth || ''}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={selectClass}
            aria-label="Entry month"
          >
            {officeExpenseMonths.length === 0 && <option value="">No months</option>}
            {officeExpenseMonths.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={openSettings} leftIcon={<Settings2 size={12} />}>
            Approvals
          </Button>
        </div>
      </div>

      <ErrorBanner error={officeExpenseEntriesError} onRetry={onRetryEntries} />
      <ErrorBanner error={officeExpenseFundError} onRetry={onRetryFund} />

      {/* ---- 3 summary boxes ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          id="office-expense-cash-in-hand"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
        >
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Banknote size={14} className="text-emerald-500" /> Cash In Hand
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.balance)}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
            <span>
              Total Funded:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.totalFunded)}
              </strong>
            </span>
            <span>
              Total Spent:{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.totalSpent)}
              </strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Main balance. An expense is deducted only when it is finally approved.
          </p>
          <Button size="sm" onClick={() => router.push('/office-expense/wallet')} leftIcon={<Wallet size={14} />} className="mt-3">
            Manage Wallet
          </Button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={14} className="text-brand-blue" /> {currentMonthName} – Total Vouchers Generated
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{currentMonthVoucherCount}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Vouchers generated in {currentMonthCode} (all statuses).
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet size={14} className="text-brand-orange" /> {currentMonthName} – Total Expense
          </p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{formatBDT(currentMonthExpenseTotal)}</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Approved expenses in {currentMonthCode}. Pending entries are excluded until approved.
          </p>
        </div>
      </div>

      {/* ---- Transaction filters ---- */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Month</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className={`${selectClass} w-full`}>
              <option value="all">All months</option>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Date</label>
            <input
              type="date"
              value={filterDate}
              max={maxEntryDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Category</label>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${selectClass} w-full`}>
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Search</label>
            <SearchBar value={search} onChange={setSearch} placeholder="Search vouchers…" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear
            </Button>
            <Button onClick={openAddEntry} leftIcon={<Plus size={14} />} disabled={!selectedMonth} size="sm">
              Add Entry
            </Button>
          </div>
        </div>
      </div>

      <div
        id="office-expense-entries-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="text-left font-bold px-4 py-3">Date</th>
              <th className="text-left font-bold px-4 py-3">Voucher</th>
              <th className="text-left font-bold px-4 py-3">Category / Subcategory</th>
              <th className="text-left font-bold px-4 py-3">Description</th>
              <th className="text-right font-bold px-4 py-3">Amount</th>
              <th className="text-left font-bold px-4 py-3">Approval Status</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <FileText size={24} className="mx-auto mb-2 opacity-50" />
                  No entries match the current filters.
                </td>
              </tr>
            ) : (
              pagedEntries.map((entry) => {
                const status = getEntryStatus(entry);
                const done = getApprovalsDone(entry);
                const required = getRequiredApprovals(entry);
                const initialsComplete = initialsCompleteOf(entry);
                const isFinal = status === 'Approved' || status === 'Rejected';
                return (
                  <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {entry.date ? String(entry.date).slice(0, 10) : '-'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {entry.voucherNo || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      <div className="font-semibold text-slate-700 dark:text-slate-200">{entry.category}</div>
                      <div className="text-[11px] text-slate-400">{entry.subCategory || '—'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={entry.description}>
                      {entry.description || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatBDT(entry.amount)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusTone(status)}`}>
                        <ShieldCheck size={11} /> {status}
                      </span>
                      {status !== 'Approved' && (
                        <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                          {status === 'Rejected' ? 'Closed' : pendingLabel(entry)}
                          {status === 'Pending Approval' && required > 0 && (
                            <span className="font-medium text-slate-400"> ({done}/{required})</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => setPrintTarget(entry)}
                        aria-label="Print voucher"
                        title="Print Voucher"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => setLogTarget(entry)}
                        aria-label="Approval history"
                        title="Approval History"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 cursor-pointer transition-colors"
                      >
                        <History size={14} />
                      </button>
                      {!isFinal && onApproveEntry && !initialsComplete && (
                        <button
                          onClick={() => handleApprove(entry)}
                          disabled={busyKey === `approve-${entry.id}`}
                          aria-label="Approve"
                          title="Approve (staff)"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <ThumbsUp size={14} />
                        </button>
                      )}
                      {!isFinal && onFinalApproveEntry && initialsComplete && (
                        <button
                          onClick={() => handleFinalApprove(entry)}
                          disabled={busyKey === `final-approve-${entry.id}`}
                          aria-label="Final approve"
                          title="Final Approve"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer transition-colors disabled:opacity-50"
                        >
                          <CheckCheck size={14} />
                        </button>
                      )}
                      {!isFinal && onReviewEntry && (
                        <button
                          onClick={() => openNoteModal(entry, 'review')}
                          aria-label="Request review"
                          title="Review Need"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors"
                        >
                          <MessageSquare size={14} />
                        </button>
                      )}
                      {!isFinal && onRejectEntry && (
                        <button
                          onClick={() => openNoteModal(entry, 'reject')}
                          aria-label="Reject entry"
                          title="Reject"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openEditEntry(entry)}
                        aria-label="Edit entry"
                        title="Edit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(entry)}
                        aria-label="Delete entry"
                        title="Delete"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filteredEntries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40">
                <td colSpan={4} className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                  Filtered Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-brand-blue-deep whitespace-nowrap">
                  {formatBDT(filteredTotal)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
        <Pagination page={safeEntryPage} totalPages={entryTotalPages} onPageChange={setEntryPage} />
      </div>

      {/* Entry Modal */}
      <Modal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        title={editingEntry ? 'Edit Expense Entry' : 'Add Expense Entry'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          {!editingEntry && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-200 dark:border-amber-800/50 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              New entries start as <strong>Pending Approval</strong> and never touch Cash In Hand until finally approved.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Date</label>
              <input
                type="date"
                value={entryDate}
                max={maxEntryDate}
                onChange={(e) => handleEntryDateChange(e.target.value)}
                onInput={(e) => handleEntryDateChange(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Voucher No.</label>
              <input
                value={voucherNo}
                readOnly
                placeholder="Auto-generated"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Category</label>
              <select
                value={entryCategory}
                onChange={(e) => {
                  setEntryCategory(e.target.value);
                  setEntrySub('');
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
              >
                {(officeExpenses || []).map((c) => (
                  <option key={c.mainCategory} value={c.mainCategory}>
                    {c.mainCategory}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Sub-Category</label>
              <select
                value={entrySub}
                onChange={(e) => setEntrySub(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
              >
                <option value="">— None —</option>
                {(categoryMap[entryCategory] || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700 resize-y"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Amount (BDT)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsEntryModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry}>{editingEntry ? 'Save Changes' : 'Add Entry'}</Button>
          </div>
        </div>
      </Modal>

      {/* Review / Reject note modal — note is mandatory */}
      <Modal
        isOpen={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title={noteTarget?.mode === 'review' ? 'Request Review' : 'Reject Entry'}
        description={
          noteTarget
            ? `${noteTarget.mode === 'review' ? 'Mark voucher' : 'Reject voucher'} ${noteTarget.entry.voucherNo || ''}? A note/reason is required.`
            : undefined
        }
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              {noteTarget?.mode === 'review' ? 'Review Note *' : 'Rejection Reason *'}
            </label>
            <textarea
              rows={4}
              value={noteTarget?.note || ''}
              onChange={(e) => setNoteTarget((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
              className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue"
              placeholder={
                noteTarget?.mode === 'review'
                  ? 'e.g. Please provide the original invoice before approval.'
                  : 'e.g. Incorrect expense amount / Missing supporting document.'
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setNoteTarget(null)} disabled={!!busyKey}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={noteTarget?.mode === 'review' ? 'secondary' : 'danger'}
              disabled={!String(noteTarget?.note || '').trim() || !!busyKey}
              onClick={submitNoteModal}
            >
              {busyKey ? 'Saving…' : noteTarget?.mode === 'review' ? 'Mark Review Need' : 'Reject Entry'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Approval history / log modal */}
      <Modal
        isOpen={!!logTarget}
        onClose={() => setLogTarget(null)}
        title={`Approval History — ${logTarget?.voucherNo ?? ''}`}
        description="Complete approval sequence: creation, approvals, reviews, rejections and final actions."
        size="xl"
        scrollable
      >
        {logTarget && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusTone(getEntryStatus(logTarget))}`}>
                <ShieldCheck size={11} /> {getEntryStatus(logTarget)}
              </span>
              {getEntryStatus(logTarget) !== 'Approved' && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  {pendingLabel(logTarget)} ({getApprovalsDone(logTarget)}/{getRequiredApprovals(logTarget)})
                </span>
              )}
              <span className="text-[11px] text-slate-400">
                Created by <strong>{formatActor(logTarget.createdBy)}</strong>
                {logTarget.createdAt ? ` · ${new Date(logTarget.createdAt).toLocaleString()}` : ''}
              </span>
            </div>
            {approvalLogsOf(logTarget).length > 0 ? (
              <ol className="relative space-y-4 pl-1">
                {approvalLogsOf(logTarget).map((entryLog, idx) => {
                  const meta = LOG_ACTION_META[entryLog.action] || { label: entryLog.action, icon: <AlertCircle size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' };
                  const logs = approvalLogsOf(logTarget);
                  const isLast = idx === logs.length - 1;
                  return (
                    <li key={`${entryLog.at}-${idx}`} className="relative pl-6">
                      {!isLast && (
                        <span className="absolute left-[9px] top-6 bottom-[-16px] w-px bg-slate-200 dark:bg-slate-800" />
                      )}
                      <span className={`absolute left-0 top-0.5 inline-flex items-center justify-center h-[18px] w-[18px] rounded-full border ${meta.tone}`}>
                        {meta.icon}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.tone}`}>
                            {meta.icon} {meta.label}
                          </span>
                          <span className="text-[10px] text-slate-400">→ {entryLog.status}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {entryLog.at ? new Date(entryLog.at).toLocaleString() : ''}
                        </span>
                      </div>
                      {entryLog.note && (
                        <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
                          {entryLog.note}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                        By <span className="font-semibold text-slate-500 dark:text-slate-300">{formatActor(entryLog.actor)}</span>
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-xs text-slate-500">No approval history recorded for this entry.</p>
            )}
            {Array.isArray(logTarget.approvals) && logTarget.approvals.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Approvals ({logTarget.approvals.length}/{getRequiredApprovals(logTarget)} required)
                </p>
                <ul className="space-y-1.5">
                  {logTarget.approvals.map((a, i) => (
                    <li key={i} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
                      <span>
                        <strong>#{i + 1}</strong> {formatActor(a?.actor)}
                        {a?.final ? ' (final)' : ''}
                      </span>
                      <span className="text-slate-400">{a?.at ? new Date(a.at).toLocaleString() : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Print voucher modal — basic layout (final design to be provided later) */}
      <Modal
        isOpen={!!printTarget}
        onClose={() => setPrintTarget(null)}
        title={`Expense Voucher — ${printTarget?.voucherNo ?? ''}`}
        size="md"
      >
        {printTarget && (
          <div className="space-y-4">
            <div id="voucher-print-area" className="border border-slate-300 rounded-xl p-6 bg-white text-slate-900">
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                <h2 className="text-lg font-black tracking-wide">ADSBUZZ LLC</h2>
                <p className="text-xs font-semibold text-slate-600">Office Expense Voucher</p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <p><strong>Voucher No:</strong> {printTarget.voucherNo || '-'}</p>
                <p><strong>Date:</strong> {printTarget.date ? String(printTarget.date).slice(0, 10) : '-'}</p>
                <p><strong>Month:</strong> {printTarget.month || '-'}</p>
                <p><strong>Status:</strong> {getEntryStatus(printTarget)}</p>
                <p className="col-span-2"><strong>Category:</strong> {printTarget.category || '-'}{printTarget.subCategory ? ` / ${printTarget.subCategory}` : ''}</p>
                <p className="col-span-2"><strong>Description:</strong> {printTarget.description || '-'}</p>
                <p className="col-span-2 text-base"><strong>Amount:</strong> {formatBDT(printTarget.amount)}</p>
                <p><strong>Prepared By:</strong> {formatActor(printTarget.createdBy)}</p>
                <p><strong>Approvals:</strong> {getApprovalsDone(printTarget)}/{getRequiredApprovals(printTarget)}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-8 text-center text-[11px]">
                <div><div className="border-t border-slate-400 pt-1 mt-8">Prepared By</div></div>
                <div><div className="border-t border-slate-400 pt-1 mt-8">Checked By</div></div>
                <div><div className="border-t border-slate-400 pt-1 mt-8">Approved By</div></div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPrintTarget(null)}>
                Close
              </Button>
              <Button size="sm" onClick={handlePrint} leftIcon={<Printer size={14} />}>
                Print Voucher
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Approval settings modal — required approvals + assigned staff */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Expense Approval Settings"
        description="New entries require this many approvals (initial staff approvals + your final approval)."
        size="sm"
      >
        <div className="space-y-4">
          {settingsError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {settingsError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Required Approvals (1–10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={requiredApprovals}
              onChange={(e) => setRequiredApprovals(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
            <p className="text-[11px] text-slate-400">e.g. 3 = 2 assigned staff approvals + 1 final approval.</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Assigned Staff / Roles (optional)</label>
            <textarea
              value={approvers}
              onChange={(e) => setApprovers(e.target.value)}
              rows={2}
              placeholder="e.g. Accounts Manager, Operations Lead"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700 resize-y"
            />
            <p className="text-[11px] text-slate-400">Separate names with commas. Applies to newly created entries.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsSettingsOpen(false)} disabled={settingsSaving}>
              Cancel
            </Button>
            <Button onClick={handleSaveSettings} disabled={settingsSaving}>
              {settingsSaving ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteEntry}
        title="Delete Expense Entry"
        message={pendingDelete ? `Delete voucher ${pendingDelete.voucherNo || ''}? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default OfficeExpenseEntryView;

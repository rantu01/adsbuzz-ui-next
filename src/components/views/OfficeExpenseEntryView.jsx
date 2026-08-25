'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  Receipt,
  Wallet,
  FileText,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US')}`;
}

function OfficeExpenseEntryView({
  officeExpenses = [],
  officeExpenseEntries = [],
  officeExpenseEntriesError,
  officeExpenseMonths = [],
  onRetryEntries,
  onRetryMonths,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onAddMonth,
  onUpdateMonth,
}) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [search, setSearch] = useState('');

  const [preparedBy, setPreparedBy] = useState('');
  const [cashInHand, setCashInHand] = useState('');
  const [savingMonth, setSavingMonth] = useState(false);

  const [isMonthModalOpen, setIsMonthModalOpen] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newPreparedBy, setNewPreparedBy] = useState('');
  const [newCashInHand, setNewCashInHand] = useState('');

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

  const categoryMap = useMemo(() => {
    const map = {};
    (officeExpenses || []).forEach((c) => {
      map[c.mainCategory] = c.subCategories || [];
    });
    return map;
  }, [officeExpenses]);

  useEffect(() => {
    if (!selectedMonth && officeExpenseMonths.length > 0) {
      setSelectedMonth(officeExpenseMonths[0].month);
    }
  }, [officeExpenseMonths, selectedMonth]);

  useEffect(() => {
    const meta = officeExpenseMonths.find((m) => m.month === selectedMonth);
    setPreparedBy(meta?.preparedBy || '');
    setCashInHand(meta?.cashInHand != null ? String(meta.cashInHand) : '');
  }, [selectedMonth, officeExpenseMonths]);

  const monthEntries = useMemo(
    () =>
      (officeExpenseEntries || [])
        .filter((e) => e.month === selectedMonth)
        .filter((e) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            (e.voucherNo || '').toLowerCase().includes(q) ||
            (e.category || '').toLowerCase().includes(q) ||
            (e.subCategory || '').toLowerCase().includes(q) ||
            (e.description || '').toLowerCase().includes(q)
          );
        }),
    [officeExpenseEntries, selectedMonth, search],
  );

  const monthTotal = useMemo(
    () => monthEntries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [monthEntries],
  );

  const openAddEntry = () => {
    setEditingEntry(null);
    setEntryDate('');
    setVoucherNo('');
    setEntryCategory(officeExpenses[0]?.mainCategory || '');
    setEntrySub('');
    setDescription('');
    setAmount('');
    setFormError('');
    setIsEntryModalOpen(true);
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
    } catch {
      // toast already shown
    }
  };

  const handleSaveMonthMeta = async () => {
    if (!selectedMonth) return;
    setSavingMonth(true);
    try {
      await onUpdateMonth(selectedMonth, {
        preparedBy,
        cashInHand: cashInHand === '' ? 0 : Number(cashInHand),
      });
    } catch {
      // toast already shown
    } finally {
      setSavingMonth(false);
    }
  };

  const handleCreateMonth = async () => {
    if (!newMonth.trim()) {
      setFormError('Month (YYYY-MM) is required.');
      return;
    }
    try {
      const created = await onAddMonth({
        month: newMonth.trim(),
        preparedBy: newPreparedBy,
        cashInHand: newCashInHand === '' ? 0 : Number(newCashInHand),
      });
      setSelectedMonth(created.month);
      setIsMonthModalOpen(false);
      setNewMonth('');
      setNewPreparedBy('');
      setNewCashInHand('');
      setFormError('');
    } catch {
      // toast already shown
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt size={22} className="text-brand-orange" />
            Monthly Data Entry
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record office expense vouchers per month, sourced from the AdsBuzz LLC accounts sheets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth || ''}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
          >
            {officeExpenseMonths.length === 0 && <option value="">No months</option>}
            {officeExpenseMonths.map((m) => (
              <option key={m.month} value={m.month}>
                {m.month}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => setIsMonthModalOpen(true)} leftIcon={<Plus size={12} />}>
            Add Month
          </Button>
        </div>
      </div>

      <ErrorBanner error={officeExpenseEntriesError} onRetry={onRetryEntries} />

      {selectedMonth && (
        <div
          id="office-expense-month-header"
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Month</label>
            <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1">
              <CalendarDays size={14} className="text-brand-blue" /> {selectedMonth}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Prepared By</label>
            <input
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Cash In Hand</label>
            <input
              type="number"
              value={cashInHand}
              onChange={(e) => setCashInHand(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs">
              <span className="text-slate-500">Total Expense</span>
              <div className="text-base font-bold text-brand-blue-deep flex items-center gap-1">
                <Wallet size={14} /> {formatBDT(monthTotal)}
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={handleSaveMonthMeta} disabled={savingMonth}>
              Save
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search vouchers…" />
        <Button onClick={openAddEntry} leftIcon={<Plus size={14} />} disabled={!selectedMonth}>
          Add Entry
        </Button>
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
              <th className="text-left font-bold px-4 py-3">Category</th>
              <th className="text-left font-bold px-4 py-3">Sub-Category</th>
              <th className="text-left font-bold px-4 py-3">Description</th>
              <th className="text-right font-bold px-4 py-3">Amount</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {monthEntries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <FileText size={24} className="mx-auto mb-2 opacity-50" />
                  No entries for this month yet.
                </td>
              </tr>
            ) : (
              monthEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {entry.date ? String(entry.date).slice(0, 10) : '-'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {entry.voucherNo || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{entry.category}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">{entry.subCategory || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={entry.description}>
                    {entry.description || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatBDT(entry.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEditEntry(entry)}
                      aria-label="Edit entry"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(entry)}
                      aria-label="Delete entry"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {monthEntries.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40">
                <td colSpan={5} className="px-4 py-3 font-bold text-slate-800 dark:text-white">
                  Month Total
                </td>
                <td className="px-4 py-3 text-right font-bold text-brand-blue-deep whitespace-nowrap">
                  {formatBDT(monthTotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Voucher No.</label>
              <input
                value={voucherNo}
                onChange={(e) => setVoucherNo(e.target.value)}
                placeholder="DV..."
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
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

      {/* Add Month Modal */}
      <Modal
        isOpen={isMonthModalOpen}
        onClose={() => setIsMonthModalOpen(false)}
        title="Add Expense Month"
        size="sm"
      >
        <div className="space-y-4">
          {formError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Month (YYYY-MM)</label>
            <input
              value={newMonth}
              onChange={(e) => setNewMonth(e.target.value)}
              placeholder="e.g. 2026-09"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Prepared By</label>
            <input
              value={newPreparedBy}
              onChange={(e) => setNewPreparedBy(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Cash In Hand</label>
            <input
              type="number"
              value={newCashInHand}
              onChange={(e) => setNewCashInHand(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsMonthModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMonth}>Create Month</Button>
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

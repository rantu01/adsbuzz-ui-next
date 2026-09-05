'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  FileText,
  Calculator,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import StatCard from '@/components/common/StatCard';

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function formatMonthLabel(month) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(month || ''));
  if (!m) return String(month || '');
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${names[Number(m[2]) - 1] || m[2]} ${m[1]}`;
}

function RefundsView({
  refunds = [],
  refundSummary = { lifetimeRefund: 0, thisMonthRefund: 0, thisMonthName: '', thisMonthLabel: '' },
  refundsError,
  paymentMethods = [],
  defaultDollarRate = 132,
  onRetry,
  onAddRefund,
  onUpdateRefund,
  onDeleteRefund,
}) {
  const [search, setSearch] = useState('');

  const [editingRefund, setEditingRefund] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [groupId, setGroupId] = useState('');
  const [adAccountName, setAdAccountName] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [dollarRate, setDollarRate] = useState(String(defaultDollarRate || ''));
  const [remainingDollar, setRemainingDollar] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0] || '');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  const [pendingDelete, setPendingDelete] = useState(null);

  // Month-wise filter (YYYY-MM) derived from each refund's existing date.
  // Empty = all months (existing behavior unchanged).
  const [selectedMonth, setSelectedMonth] = useState('');

  // Pagination for the refund logs.
  const [currentPage, setCurrentPage] = useState(1);
  const REFUNDS_PER_PAGE = 10;

  useEffect(() => {
    if (!paymentMethod && paymentMethods.length > 0) {
      setPaymentMethod(paymentMethods[0]);
    }
  }, [paymentMethods, paymentMethod]);

  useEffect(() => {
    if (dollarRate === '' && defaultDollarRate) {
      setDollarRate(String(defaultDollarRate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultDollarRate]);

  const computedBDT = useMemo(() => {
    const rate = Number(dollarRate) || 0;
    const rem = Number(remainingDollar) || 0;
    return Math.round((rate * rem + Number.EPSILON) * 100) / 100;
  }, [dollarRate, remainingDollar]);

  const filteredRefunds = useMemo(
    () =>
      (refunds || [])
        .filter((r) => {
          if (selectedMonth && String(r.date || '').slice(0, 7) !== selectedMonth) return false;
          if (!search) return true;
          const q = search.toLowerCase();
          return (
            (r.groupId || '').toLowerCase().includes(q) ||
            (r.adAccountName || '').toLowerCase().includes(q) ||
            (r.adAccountId || '').toLowerCase().includes(q) ||
            (r.paymentMethod || '').toLowerCase().includes(q) ||
            (r.note || '').toLowerCase().includes(q)
          );
        }),
    [refunds, search, selectedMonth],
  );

  // Refunds belonging to the selected month (ignores the search text) — drives
  // the monthly summary totals.
  const monthRefunds = useMemo(
    () =>
      !selectedMonth
        ? []
        : (refunds || []).filter((r) => String(r.date || '').slice(0, 7) === selectedMonth),
    [refunds, selectedMonth],
  );

  const monthTotalAmount = useMemo(
    () => monthRefunds.reduce((sum, r) => sum + (Number(r.totalAmountBDT) || 0), 0),
    [monthRefunds],
  );

  const monthLabel = selectedMonth ? formatMonthLabel(selectedMonth) : '';

  // Paginated slice of the (month + search) filtered logs.
  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / REFUNDS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRefunds = filteredRefunds.slice(
    (safeCurrentPage - 1) * REFUNDS_PER_PAGE,
    safeCurrentPage * REFUNDS_PER_PAGE,
  );

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    const start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedMonth, refunds]);

  const openAdd = () => {
    setEditingRefund(null);
    setDate(todayStr());
    setGroupId('');
    setAdAccountName('');
    setAdAccountId('');
    setDollarRate(String(defaultDollarRate || ''));
    setRemainingDollar('');
    setPaymentMethod(paymentMethods[0] || '');
    setNote('');
    setFormError('');
  };

  const openEdit = (refund) => {
    setEditingRefund(refund);
    setDate(refund.date ? String(refund.date).slice(0, 10) : todayStr());
    setGroupId(refund.groupId || '');
    setAdAccountName(refund.adAccountName || '');
    setAdAccountId(refund.adAccountId || '');
    setDollarRate(String(refund.dollarRate ?? ''));
    setRemainingDollar(String(refund.remainingDollar ?? ''));
    setPaymentMethod(refund.paymentMethod || paymentMethods[0] || '');
    setNote(refund.note || '');
    setFormError('');
  };

  const handleSubmit = async () => {
    if (!groupId.trim()) {
      setFormError('Group ID is required.');
      return;
    }
    if (!adAccountName.trim()) {
      setFormError('Ad Account Name is required.');
      return;
    }
    if (!adAccountId.trim()) {
      setFormError('Ad Account ID is required.');
      return;
    }
    const rate = Number(dollarRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setFormError('Dollar Rate must be greater than 0.');
      return;
    }
    const rem = Number(remainingDollar);
    if (!Number.isFinite(rem) || rem < 0) {
      setFormError('Remaining Dollar must be a valid number.');
      return;
    }
    if (!paymentMethod) {
      setFormError('Refund Method is required.');
      return;
    }
    if (!note.trim()) {
      setFormError('Note is required.');
      return;
    }

    const payload = {
      date,
      groupId: groupId.trim(),
      adAccountName: adAccountName.trim(),
      adAccountId: adAccountId.trim(),
      dollarRate: rate,
      remainingDollar: rem,
      paymentMethod,
      note: note.trim(),
    };

    try {
      if (editingRefund) {
        await onUpdateRefund({ ...editingRefund, ...payload });
      } else {
        await onAddRefund(payload);
      }
      setEditingRefund(null);
      setDate(todayStr());
      setGroupId('');
      setAdAccountName('');
      setAdAccountId('');
      setDollarRate(String(defaultDollarRate || ''));
      setRemainingDollar('');
      setPaymentMethod(paymentMethods[0] || '');
      setNote('');
      setFormError('');
    } catch {
      // toast already shown
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await onDeleteRefund(pendingDelete.id);
    } catch {
      // toast already shown
    } finally {
      setPendingDelete(null);
    }
  };

  const lifetime = Number(refundSummary?.lifetimeRefund) || 0;
  const thisMonth = Number(refundSummary?.thisMonthRefund) || 0;
  const thisMonthLabel = refundSummary?.thisMonthLabel || refundSummary?.thisMonthName || '';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <RotateCcw size={22} className="text-brand-orange" />
            Refund
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Record ad-account refunds and track total amounts returned to customers.
          </p>
        </div>
        <Button onClick={openAdd} leftIcon={<Plus size={14} />}>
          New Refund
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          id="refund-lifetime-card"
          title="Lifetime Refund"
          value={formatBDT(lifetime)}
          subtext="Total refunded across all time"
          variant="rose"
        />
        <StatCard
          id="refund-this-month-card"
          title={thisMonthLabel ? `This Month — ${thisMonthLabel} Refund` : 'This Month Refund'}
          value={formatBDT(thisMonth)}
          subtext="Refunded in the current month"
          variant="amber"
        />
      </div>

      <ErrorBanner error={refundsError} onRetry={onRetry} />

      {/* Refund Form */}
      <div
        id="refund-form-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
      >
        <h2 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-brand-blue" />
          {editingRefund ? 'Edit Refund' : 'Record New Refund'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Group ID</label>
            <input
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder="GC-..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Ad Account Name</label>
            <input
              value={adAccountName}
              onChange={(e) => setAdAccountName(e.target.value)}
              placeholder="e.g. Bijoy FB Primary"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Ad Account ID</label>
            <input
              value={adAccountId}
              onChange={(e) => setAdAccountId(e.target.value)}
              placeholder="e.g. ACT-2201"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Dollar Rate</label>
            <input
              type="number"
              step="0.01"
              value={dollarRate}
              onChange={(e) => setDollarRate(e.target.value)}
              placeholder="132"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Remaining Dollar</label>
            <input
              type="number"
              step="0.01"
              value={remainingDollar}
              onChange={(e) => setRemainingDollar(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Refund Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            >
              {paymentMethods.length === 0 && <option value="">No payment methods</option>}
              {paymentMethods.map((pm) => (
                <option key={pm} value={pm}>
                  {pm}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Total Amount BDT</label>
            <div className="w-full px-3 py-2 text-sm font-bold text-brand-blue-deep bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              {formatBDT(computedBDT)}
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Note <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for refund (required)"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700 resize-y"
            />
          </div>
        </div>

        {formError && (
          <div className="mt-3 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
            {formError}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={openAdd}>
            Clear
          </Button>
          <Button onClick={handleSubmit}>
            {editingRefund ? 'Save Changes' : 'Submit'}
          </Button>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-800 dark:text-white">Refund Transaction Log</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            id="refund-month-filter"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            aria-label="Filter refunds by month"
            className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          />
          {selectedMonth && (
            <button
              id="refund-month-clear"
              type="button"
              onClick={() => setSelectedMonth('')}
              className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <SearchBar value={search} onChange={setSearch} placeholder="Search refunds…" />
        </div>
      </div>

      {/* Monthly Summary — shown when a month is selected */}
      {selectedMonth && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            id="refund-month-total-card"
            title={`Total Amount Of Refund — ${monthLabel}`}
            value={formatBDT(monthTotalAmount)}
            subtext={`Refunded in ${monthLabel}`}
            variant="rose"
          />
          <StatCard
            id="refund-month-count-card"
            title={`Total Refund Transactions — ${monthLabel}`}
            value={String(monthRefunds.length)}
            subtext={`Refund records in ${monthLabel}`}
            variant="amber"
          />
        </div>
      )}

      <div
        id="refund-log-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="text-left font-bold px-4 py-3">Date</th>
              <th className="text-left font-bold px-4 py-3">Group ID</th>
              <th className="text-left font-bold px-4 py-3">Ad Account Name / ID</th>
              <th className="text-right font-bold px-4 py-3">Remaining Dollar</th>
              <th className="text-right font-bold px-4 py-3">BDT Amount</th>
              <th className="text-left font-bold px-4 py-3">Payment Method</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRefunds.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <FileText size={24} className="mx-auto mb-2 opacity-50" />
                  No refund records found.
                </td>
              </tr>
            ) : (
              paginatedRefunds.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {r.date ? String(r.date).slice(0, 10) : '-'}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {r.groupId || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{r.adAccountName || '-'}</div>
                    <div className="text-slate-400">{r.adAccountId || '-'}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    ${(Number(r.remainingDollar) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatBDT(r.totalAmountBDT)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {r.paymentMethod || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(r)}
                      aria-label="Edit refund"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-blue hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(r)}
                      aria-label="Delete refund"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {filteredRefunds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing {(safeCurrentPage - 1) * REFUNDS_PER_PAGE + 1}–
            {Math.min(safeCurrentPage * REFUNDS_PER_PAGE, filteredRefunds.length)} of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredRefunds.length}</span>{' '}
            refund records
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Prev
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page)}
                className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  page === safeCurrentPage
                    ? 'bg-brand-orange text-white shadow-md shadow-orange-500/20'
                    : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handlePageChange(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title="Delete Refund"
        message={pendingDelete ? `Delete refund for ${pendingDelete.groupId || ''} (${formatBDT(pendingDelete.totalAmountBDT)})? This cannot be undone.` : ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default RefundsView;

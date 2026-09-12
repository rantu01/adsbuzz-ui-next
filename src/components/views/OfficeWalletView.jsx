'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Wallet,
  Plus,
  Banknote,
  ArrowDownCircle,
  ArrowUpCircle,
  Edit2,
  Trash2,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Pagination from '@/components/common/Pagination';
import { useAuth } from '@/context/AuthContext';

const ADD_PAGE_SIZE = 10;
const USAGE_PAGE_SIZE = 10;

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US')}`;
}

function formatActor(actor) {
  if (!actor) return '—';
  if (typeof actor === 'string') return actor;
  return actor.name || actor.username || actor.email || actor.uid || '—';
}

function formatEditor(editor) {
  if (!editor) return '—';
  if (typeof editor === 'string') return editor;
  const username = editor.username || editor.name || editor.email || editor.uid || '—';
  return editor.role ? `${username} (${editor.role})` : username;
}

function buildActor(user) {
  if (!user) return null;
  const username = user.displayName || user.name || user.username || '';
  return {
    uid: user.uid || user.id || '',
    name: username,
    username,
    email: user.email || '',
    ...(user.role ? { role: user.role } : {}),
  };
}

function formatDateTime(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

const ADD_TYPES = ['fund', 'opening'];
const USAGE_TYPES = ['expense', 'expense_adjust', 'expense_reversal'];

function usageLabel(type) {
  switch (type) {
    case 'expense':
      return 'Expense';
    case 'expense_adjust':
      return 'Adjustment';
    case 'expense_reversal':
      return 'Refund';
    default:
      return type || '-';
  }
}

function OfficeWalletView({
  officeExpenseFund = null,
  officeExpenseFundTransactions = [],
  officeExpenseFundLoading = false,
  officeExpenseFundError = null,
  onRetryFund,
  onAddFunds,
  onUpdateFunds,
  onDeleteFunds,
}) {
  const { user } = useAuth();

  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [fundNote, setFundNote] = useState('');
  const [fundFormError, setFundFormError] = useState('');
  const [fundSaving, setFundSaving] = useState(false);

  const [editingTxn, setEditingTxn] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deletingTxn, setDeletingTxn] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const [addPage, setAddPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);

  // Ad Money History — every addition into the wallet, including who added it.
  const addHistory = useMemo(
    () => (officeExpenseFundTransactions || []).filter((t) => ADD_TYPES.includes(t.type)),
    [officeExpenseFundTransactions],
  );

  // Wallet Balance Usage History — every deduction / adjustment / refund.
  const usageHistory = useMemo(
    () => (officeExpenseFundTransactions || []).filter((t) => USAGE_TYPES.includes(t.type)),
    [officeExpenseFundTransactions],
  );

  useEffect(() => {
    setAddPage(1);
    setUsagePage(1);
  }, [officeExpenseFundTransactions]);

  const addTotalPages = Math.max(1, Math.ceil(addHistory.length / ADD_PAGE_SIZE));
  const safeAddPage = Math.min(addPage, addTotalPages);
  const pagedAdditions = useMemo(
    () => addHistory.slice((safeAddPage - 1) * ADD_PAGE_SIZE, safeAddPage * ADD_PAGE_SIZE),
    [addHistory, safeAddPage],
  );

  const usageTotalPages = Math.max(1, Math.ceil(usageHistory.length / USAGE_PAGE_SIZE));
  const safeUsagePage = Math.min(usagePage, usageTotalPages);
  const pagedUsage = useMemo(
    () => usageHistory.slice((safeUsagePage - 1) * USAGE_PAGE_SIZE, safeUsagePage * USAGE_PAGE_SIZE),
    [usageHistory, safeUsagePage],
  );

  const openFundModal = () => {
    setFundAmount('');
    setFundNote('');
    setFundFormError('');
    setIsFundModalOpen(true);
  };

  const handleAddFunds = async () => {
    const amt = Number(fundAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFundFormError('Enter a valid amount greater than 0.');
      return;
    }
    if (!onAddFunds) {
      setFundFormError('Funding is not available right now.');
      return;
    }
    setFundSaving(true);
    try {
      await onAddFunds({
        amount: amt,
        note: fundNote.trim(),
        month: '',
        actor: user ? { uid: user.uid || '', name: user.displayName || user.name || '', email: user.email || '' } : null,
      });
      setIsFundModalOpen(false);
      setFundAmount('');
      setFundNote('');
      setFundFormError('');
    } catch {
      // toast already shown by the hook
    } finally {
      setFundSaving(false);
    }
  };

  const openEditModal = (txn) => {
    setEditingTxn(txn);
    setEditAmount(String(txn.amount ?? ''));
    setEditNote(txn.note || '');
    setEditReason('');
    setEditFormError('');
  };

  const handleUpdateFunds = async () => {
    const amt = Number(editAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setEditFormError('Enter a valid amount greater than 0.');
      return;
    }
    if (!editReason.trim()) {
      setEditFormError('Please add a note explaining why this edit is being made.');
      return;
    }
    if (!onUpdateFunds || !editingTxn) {
      setEditFormError('Editing is not available right now.');
      return;
    }
    setEditSaving(true);
    try {
      await onUpdateFunds(editingTxn.id, {
        amount: amt,
        note: editNote.trim(),
        editNote: editReason.trim(),
        actor: buildActor(user),
      });
      setEditingTxn(null);
      setEditAmount('');
      setEditNote('');
      setEditReason('');
      setEditFormError('');
    } catch {
      // toast already shown by the hook
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteFunds = async () => {
    if (!onDeleteFunds || !deletingTxn) return;
    setDeleteSaving(true);
    try {
      await onDeleteFunds(deletingTxn.id);
      setDeletingTxn(null);
    } catch {
      // toast already shown by the hook
    } finally {
      setDeleteSaving(false);
    }
  };

  const balanceText = officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.balance);
  const fundedText = officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.totalFunded);
  const spentText = officeExpenseFundLoading && !officeExpenseFund ? '…' : formatBDT(officeExpenseFund?.totalSpent);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet size={22} className="text-brand-orange" />
            Office Wallet
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Add and manage ad money, and review the complete wallet history from one place.
          </p>
        </div>
        <Button onClick={openFundModal} leftIcon={<Plus size={14} />}>
          Ad Money
        </Button>
      </div>

      <ErrorBanner error={officeExpenseFundError} onRetry={onRetryFund} />

      {/* Wallet balance summary */}
      <div
        id="office-wallet-balance"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Banknote size={14} className="text-emerald-500" /> Wallet Balance
            </p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{balanceText}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500">
              <span>
                Total Funded:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">{fundedText}</strong>
              </span>
              <span>
                Total Spent:{' '}
                <strong className="text-rose-600 dark:text-rose-400">{spentText}</strong>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Approved office expenses are deducted from this balance automatically.
            </p>
          </div>
          <Button onClick={openFundModal} leftIcon={<Plus size={14} />}>
            Ad Money
          </Button>
        </div>
      </div>

      {/* Ad Money History */}
      <div
        id="office-wallet-add-history"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownCircle size={14} className="text-emerald-500" /> Ad Money History
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="text-left font-bold px-4 py-3">Date</th>
              <th className="text-left font-bold px-4 py-3">Type</th>
              <th className="text-left font-bold px-4 py-3">Added By</th>
              <th className="text-left font-bold px-4 py-3">Month</th>
              <th className="text-left font-bold px-4 py-3">Note</th>
              <th className="text-right font-bold px-4 py-3">Amount</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pagedAdditions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No ad money added yet. Use “Ad Money” to fund the wallet.
                </td>
              </tr>
            ) : (
              pagedAdditions.map((txn) => {
                const editCount = Array.isArray(txn.editHistory) ? txn.editHistory.length : 0;
                const lastEdit = editCount > 0 ? txn.editHistory[editCount - 1] : null;
                const historyTitle = editCount > 0
                  ? txn.editHistory.map((h) => `${formatDateTime(h.editedAt)} — ${formatEditor(h.editedBy)}: ${h.oldAmount} → ${h.newAmount}${h.editNote ? ` (${h.editNote})` : ''}`).join('\n')
                  : undefined;
                return (
                <tr key={txn.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatDateTime(txn.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      {txn.type === 'opening' ? 'Opening' : 'Fund Added'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {formatActor(txn.addedBy)}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {txn.month || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs" title={txn.note || undefined}>
                    <span className="block truncate">{txn.note || '-'}</span>
                    {lastEdit && (
                      <span className="block text-[10px] text-slate-400 truncate" title={historyTitle}>
                        Edited by {formatEditor(lastEdit.editedBy || txn.lastEditedBy)}{lastEdit.editNote ? ` — ${lastEdit.editNote}` : ''}
                        {editCount > 1 ? ` (${editCount} edits)` : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    +{formatBDT(txn.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(txn)}
                        leftIcon={<Edit2 size={11} />}
                        title="Edit entry"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingTxn(txn)}
                        leftIcon={<Trash2 size={11} />}
                        className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                        title="Delete entry"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination page={safeAddPage} totalPages={addTotalPages} onPageChange={setAddPage} />
      </div>

      {/* Wallet Balance Usage History */}
      <div
        id="office-wallet-usage-history"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto"
      >
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpCircle size={14} className="text-rose-500" /> Wallet Balance Usage History
          </h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="text-left font-bold px-4 py-3">Date</th>
              <th className="text-left font-bold px-4 py-3">Type</th>
              <th className="text-left font-bold px-4 py-3">Month / Voucher</th>
              <th className="text-left font-bold px-4 py-3">Note</th>
              <th className="text-right font-bold px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {pagedUsage.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No wallet usage recorded yet. Approved expenses will appear here.
                </td>
              </tr>
            ) : (
              pagedUsage.map((txn) => {
                const amt = Number(txn.amount) || 0;
                const positive = amt >= 0;
                return (
                  <tr key={txn.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDateTime(txn.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          txn.type === 'expense_reversal'
                            ? 'bg-blue-500/15 text-brand-blue dark:text-blue-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {usageLabel(txn.type)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {[txn.month, txn.voucherNo].filter(Boolean).join(' · ') || '-'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={txn.note}>
                      {txn.note || '-'}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-bold whitespace-nowrap ${positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {positive ? '+' : '−'}{formatBDT(Math.abs(amt))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <Pagination page={safeUsagePage} totalPages={usageTotalPages} onPageChange={setUsagePage} />
      </div>

      {/* Ad Money Modal */}
      <Modal
        isOpen={isFundModalOpen}
        onClose={() => setIsFundModalOpen(false)}
        title="Ad Money — Add to Office Wallet"
        description="Funding will be available for approved office expenses."
        size="sm"
      >
        <div className="space-y-4">
          {fundFormError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {fundFormError}
            </div>
          )}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            Current wallet balance: <strong>{balanceText}</strong>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Amount (BDT) *</label>
            <input
              type="number"
              min="1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Note (optional)</label>
            <input
              value={fundNote}
              onChange={(e) => setFundNote(e.target.value)}
              placeholder="e.g. Monthly office fund from accounts"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setIsFundModalOpen(false)} disabled={fundSaving}>
              Cancel
            </Button>
            <Button onClick={handleAddFunds} disabled={fundSaving} leftIcon={<Banknote size={14} />}>
              {fundSaving ? 'Adding…' : 'Add Money'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Ad Money Modal */}
      <Modal
        isOpen={!!editingTxn}
        onClose={() => setEditingTxn(null)}
        title="Edit Ad Money Entry"
        description={editingTxn ? `Editing entry of ${formatBDT(editingTxn.amount)} added on ${formatDateTime(editingTxn.createdAt)}.` : undefined}
        size="sm"
      >
        <div className="space-y-4">
          {editFormError && (
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 rounded-lg px-3 py-2">
              {editFormError}
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Amount (BDT) *</label>
            <input
              type="number"
              min="1"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Note</label>
            <input
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="e.g. Monthly office fund from accounts"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">Edit Note (reason for this edit) *</label>
            <textarea
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Amount entered incorrectly, correcting from voucher"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
            />
            <p className="text-[11px] text-slate-400">This note is stored with your username and role in the edit history.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setEditingTxn(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFunds} disabled={editSaving} leftIcon={<Edit2 size={14} />}>
              {editSaving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Ad Money Modal */}
      <Modal
        isOpen={!!deletingTxn}
        onClose={() => setDeletingTxn(null)}
        title="Delete Ad Money Entry"
        description={deletingTxn ? `This will remove ${formatBDT(deletingTxn.amount)} from the wallet balance.` : undefined}
        size="sm"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-rose-500/10 border border-rose-200 dark:border-rose-800/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
            Are you sure you want to delete this entry? The wallet balance and totals will be adjusted accordingly. This cannot be undone.
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeletingTxn(null)} disabled={deleteSaving}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeleteFunds} disabled={deleteSaving} leftIcon={<Trash2 size={12} />}>
              {deleteSaving ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OfficeWalletView;

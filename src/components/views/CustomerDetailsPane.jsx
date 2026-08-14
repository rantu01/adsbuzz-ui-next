'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Star,
  Briefcase,
  FileText,
  Layers,
  FileEdit,
  Save,
  ArrowUpRight,
  Trash2,
  UserX,
  Clock,
  CheckCircle,
  AlertCircle,
  UserRound,
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/ui/Button';
import { useCustomerActivities } from '@/hooks/useCustomerActivities';

const INVOICE_PAGE_SIZE = 10;

function CustomerDetailsPane({
  customer,
  stats,
  onToggleFavorite,
  onTopup,
  onEdit,
  onRequestAssign,
  onDelete,
  onNotesSave,
  onUnassignAdAccount,
  setups = [],
}) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);

  const { activities: historyActivities, loading: historyLoading } = useCustomerActivities(customer?.id);

  // Active "Ad Account Sales Setup" entries keyed by adAccountId for this customer's group.
  // If a setup record exists for the account + group the account is "configured"; otherwise we
  // surface the "Please Setup sales rules for this Ad Account" prompt.
  const configuredSetupByAccount = useMemo(() => {
    const map = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Ad Account Sales Setup' || s.status !== 'Active' || !s.adAccountId) return;
      if (!map.has(s.adAccountId)) map.set(s.adAccountId, new Set());
      map.get(s.adAccountId).add(s.groupId);
    });
    return map;
  }, [setups]);

  // Latest Active Sale Setup record (by adAccountId + customer group) so the
  // "Rate" shown for an assigned account reflects the Dollar Rate configured in
  // Sales Setup instead of the ad account's bootstrap/default value.
  const setupRecordByAccountAndGroup = useMemo(() => {
    const map = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Ad Account Sales Setup' || s.status !== 'Active' || !s.adAccountId) return;
      map.set(`${s.adAccountId}|${s.groupId}`, s);
    });
    return map;
  }, [setups]);

  const getConfiguredSetup = useCallback(
    (acc) => setupRecordByAccountAndGroup.get(`${acc.adAccountId}|${customer?.groupId}`) || null,
    [setupRecordByAccountAndGroup, customer?.groupId],
  );

  // Effective dollar rate for an account: the Sales Setup configured rate wins;
  // fall back to the account's own rate when no setup exists for it.
  const getDisplayRate = useCallback(
    (acc) => {
      const configured = getConfiguredSetup(acc)?.dollarRate;
      return Number(configured) > 0 ? configured : acc.dollarRate;
    },
    [getConfiguredSetup],
  );

  const isSalesSetupConfigured = useCallback(
    (acc) => {
      const groups = configuredSetupByAccount.get(acc.adAccountId);
      if (!groups) return false;
      return groups.has(customer?.groupId);
    },
    [configuredSetupByAccount, customer?.groupId],
  );

  const TYPE_ICON = {
    sale: <ArrowUpRight size={11} className="text-brand-orange" />,
    account: <Layers size={11} className="text-brand-blue" />,
    payment: <CheckCircle size={11} className="text-emerald-500" />,
    customer: <UserRound size={11} className="text-amber-500" />,
    system: <AlertCircle size={11} className="text-slate-400" />,
  };

  // Reset drawer-local state whenever the selected customer changes.
  useEffect(() => {
    setEditingNotes(false);
    setNotesText(customer?.notes || '');
    setInvoicePage(1);
  }, [customer?.id, customer?.notes]);

  const accounts = stats?.accounts || [];
  const invoices = stats?.invoices || [];
  const invoiceTotalPages = Math.max(1, Math.ceil(invoices.length / INVOICE_PAGE_SIZE));
  const pagedInvoices = invoices.slice(
    (invoicePage - 1) * INVOICE_PAGE_SIZE,
    invoicePage * INVOICE_PAGE_SIZE,
  );

  const handleNotesEditStart = () => {
    setNotesText(customer?.notes || '');
    setEditingNotes(true);
  };

  // Optimistic save — exit edit mode immediately; the hook rolls back on failure.
  const handleNotesSave = () => {
    if (customer) onNotesSave(customer.id, notesText);
    setEditingNotes(false);
  };

  return (
    <div
      className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
      id="customer-details-pane"
    >
      {/* Header info */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-brand-orange text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              {customer.avatar || customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">{customer.name}</h2>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(customer.id)}
                  aria-label={customer.favorite ? `Remove ${customer.name} from favorites` : `Add ${customer.name} to favorites`}
                  aria-pressed={customer.favorite}
                  className="text-slate-400 hover:text-amber-500 transition-colors p-0.5 cursor-pointer flex-shrink-0"
                >
                  <Star size={14} className={customer.favorite ? "fill-amber-500 text-amber-500" : ""} />
                </button>
              </div>
              <div className="mt-0.5 space-y-0.5">
                <p className="text-[10px] font-mono font-bold text-brand-blue dark:text-blue-400">
                  Customer ID: {customer.id}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-brand-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                    Group ID: {customer.groupId || 'GC-GENERIC'}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 truncate">
                    <Briefcase size={11} /> {customer.companyName}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Badges & Small Organized Action Controls */}
          <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap flex-shrink-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
              customer.status === 'Active'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60'
                : customer.status === 'Lost'
                  ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200/60'
            }`}>
              {customer.status}
            </span>
            <Button
              id="btn-edit-customer"
              variant="outline"
              size="sm"
              onClick={onEdit}
              leftIcon={<FileEdit size={11} />}
            >
              Edit
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onTopup(customer.id)}
              leftIcon={<ArrowUpRight size={11} />}
              className="shadow-xs"
            >
              Quick Topup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestAssign}
              leftIcon={<Layers size={11} />}
            >
              Assign Account
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onDelete}
              leftIcon={<Trash2 size={11} />}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Total Topup & Monthly Spend Overview Card */}
        <div className="mt-4 grid grid-cols-3 gap-3 p-3.5 sm:p-4 rounded-xl border border-border-green dark:border-border-green bg-surface-green dark:bg-surface-green text-brand-blue-deep dark:text-brand-blue-deep shadow-xs">
          <div>
            <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider">TOTAL TOPUP (USD)</p>
            <p className="text-base sm:text-lg font-extrabold text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">${(stats?.totalUSD || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider">TOTAL TOPUP (BDT)</p>
            <p className="text-base sm:text-lg font-extrabold text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">৳{(stats?.totalBDT || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 tracking-wider">MONTHLY SPEND</p>
            <p className="text-base sm:text-lg font-extrabold text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">${(customer.creditLimitUSD || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Profile Content Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/5">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex-1 py-2.5 text-[11px] font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === 'accounts'
              ? 'border-brand-blue text-brand-blue bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Assigned Ad Accounts ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 text-[11px] font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'border-brand-blue text-brand-blue bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Topup Ledger History ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2.5 text-[11px] font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === 'notes'
              ? 'border-brand-blue text-brand-blue bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Profile CRM Notes
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-2.5 text-[11px] font-semibold text-center border-b-2 transition-all cursor-pointer ${
            activeTab === 'activity'
              ? 'border-brand-blue text-brand-blue bg-white dark:bg-slate-900'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Activity / History ({historyActivities.length})
        </button>
      </div>

      {/* Tab Panes */}
      <div className="p-4 sm:p-5">

        {/* Tab 1: Assigned Accounts */}
        {activeTab === 'accounts' && (
          <div className="space-y-4">
            {accounts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                <Layers className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-xs">No active advertising accounts assigned to this customer.</p>
                <button
                  onClick={onRequestAssign}
                  className="mt-3 text-xs font-semibold text-brand-orange hover:underline cursor-pointer"
                >
                  Allocate Ad Account Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <div
                    key={acc.adAccountId}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-white dark:bg-slate-900 shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                          {acc.adAccountName}
                        </h4>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          acc.accountStatus === 'Active'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                          {acc.accountStatus}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">ID: {acc.adAccountId}</div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Platform: <PlatformText platform={acc.platform} className="font-semibold text-[10px]" /></span>
                      <span className="text-slate-400">Rate: <span className="font-semibold text-slate-600 dark:text-slate-300">৳{getDisplayRate(acc)}</span></span>
                    </div>

                    {!isSalesSetupConfigured(acc) && (
                      <div className="mt-3 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-500/10">
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle size={11} className="flex-shrink-0" />
                          Please Setup sales rules for this Ad Account
                        </p>
                        <a
                          href="/sale-setup"
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Configure in Sale Setup <ArrowUpRight size={10} />
                        </a>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUnassignAdAccount(acc.adAccountId)}
                        leftIcon={<UserX size={11} />}
                      >
                        Unassign
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Purchase History / Invoices */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                <FileText className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-xs">No invoice records on file for this customer.</p>
              </div>
            ) : (
              <div className="w-full rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400 border-collapse table-fixed">
                  <thead className="bg-brand-blue text-white">
                    <tr>
                      <th scope="col" className="py-2 px-1.5 sm:px-2.5 font-bold tracking-tight text-[10px] sm:text-xs w-[28%]">Invoice No</th>
                      <th scope="col" className="py-2 px-1.5 sm:px-2.5 font-bold tracking-tight text-[10px] sm:text-xs w-[22%]">Date</th>
                      <th scope="col" className="py-2 px-1 sm:px-2 text-right font-bold tracking-tight text-[10px] sm:text-xs w-[18%]">Amount USD</th>
                      <th scope="col" className="py-2 px-1 sm:px-2 text-right font-bold tracking-tight text-[10px] sm:text-xs w-[18%]">Paid BDT</th>
                      <th scope="col" className="py-2 px-1 sm:px-2 text-center font-bold tracking-tight text-[10px] sm:text-xs w-[14%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {pagedInvoices.map((inv) => (
                      <tr key={inv.invoiceNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-1.5 sm:px-2.5 font-bold text-slate-900 dark:text-white font-mono text-[10px] sm:text-xs truncate" title={inv.invoiceNo}>{inv.invoiceNo}</td>
                        <td className="py-2 px-1.5 sm:px-2.5 text-slate-600 dark:text-slate-400 font-medium text-[10px] sm:text-xs truncate">{inv.date}</td>
                        <td className="py-2 px-1 sm:px-2 text-right font-black text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs">${(inv.topupAmountUSD || 0).toLocaleString()}</td>
                        <td className="py-2 px-1 sm:px-2 text-right font-bold text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs">৳{(inv.paidAmountBDT || 0).toLocaleString()}</td>
                        <td className="py-2 px-1 sm:px-2 text-center">
                          <span className={`inline-block px-1 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold truncate max-w-full ${
                            inv.paymentStatus === 'Paid'
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {inv.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={invoicePage} totalPages={invoiceTotalPages} onPageChange={setInvoicePage} />
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Notes */}
        {activeTab === 'notes' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Account Relationship Notes</h4>
              {!editingNotes ? (
                <Button
                  id="btn-edit-notes"
                  variant="outline"
                  size="sm"
                  onClick={handleNotesEditStart}
                  leftIcon={<FileEdit size={11} />}
                >
                  Edit Notes
                </Button>
              ) : (
                <div className="flex gap-2">
                  <button
                    id="btn-save-notes"
                    onClick={handleNotesSave}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Save size={12} /> Save
                  </button>
                  <button
                    id="btn-cancel-notes"
                    onClick={() => setEditingNotes(false)}
                    className="text-xs font-semibold text-slate-400 hover:underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {editingNotes ? (
              <textarea
                id="notes-textarea"
                rows={5}
                className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
            ) : (
              <div className="p-4 rounded-xl bg-surface-blue-light dark:bg-surface-blue-light border border-border-blue-light dark:border-border-blue-light text-xs text-brand-blue-deep dark:text-brand-blue-deep leading-relaxed min-h-[100px]">
                {customer.notes ? (
                  <p className="whitespace-pre-wrap">{customer.notes}</p>
                ) : (
                  <p className="text-slate-400 italic">No notes on file. Add relationship records to help sales desk staff.</p>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">CRM Metadata</h5>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Created:</span> <span className="font-semibold text-slate-700 dark:text-slate-300">{customer.createdAt}</span>
                </div>
                <div>
                  <span className="text-slate-400">Customer ID:</span> <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{customer.id}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Activity / History (full customer journey) */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            {historyLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 items-start animate-pulse">
                    <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-2.5 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2 w-56 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : historyActivities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                <Clock className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-xs">No activity recorded for this customer yet.</p>
                <p className="text-[10px] mt-1">Account assignments, top-ups and profile changes will appear here.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-2.5 pl-3 space-y-5 pb-2">
                {historyActivities.map((act) => {
                  const Icon = TYPE_ICON[act.type] || <Clock size={11} className="text-slate-400" />;
                  return (
                    <div key={act.id || act._id} className="relative pl-3">
                      <span className="absolute -left-3 top-0.5 flex items-center justify-center h-5 w-5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        {Icon}
                      </span>
                      <div className="ml-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{act.action}</p>
                          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">{act.time || ''}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed break-words">
                          {act.details}
                        </p>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          by <span className="font-medium text-slate-600 dark:text-slate-300">{act.user || 'System'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(CustomerDetailsPane);
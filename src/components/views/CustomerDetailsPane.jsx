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
  Search,
  TrendingUp,
  BarChart3,
  Target,
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Pagination from '@/components/common/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useCustomerActivities } from '@/hooks/useCustomerActivities';

const INVOICE_PAGE_SIZE = 10;
const ACCOUNT_PAGE_SIZE = 6;
const ACTIVITY_PAGE_SIZE = 10;

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
  onConfigureSaleSetup,
  setups = [],
}) {
  const [activeTab, setActiveTab] = useState('accounts');
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [invoicePage, setInvoicePage] = useState(1);
  const [accountPage, setAccountPage] = useState(1);
  const [activityPage, setActivityPage] = useState(1);

  // Search filter for the "Assigned Ad Accounts" tab — matches by Ad Account
  // Name or ID so the user can quickly narrow down a customer's accounts.
  const [accountSearch, setAccountSearch] = useState('');

  // Unassign Ad Account reason popup state
  const [unassignTarget, setUnassignTarget] = useState(null);
  const [unassignReason, setUnassignReason] = useState('');
  const [unassigning, setUnassigning] = useState(false);

  const { activities: historyActivities, loading: historyLoading } = useCustomerActivities(customer?.id);

  // The Activity / History tab is scoped strictly to Assign / Unassign logs.
  // Topup records live in the dedicated "Topup Ledger History" tab, so they are
  // excluded here.
  const assignActivities = useMemo(
    () => historyActivities.filter(a => /assign|unassign/i.test(a.action || '')),
    [historyActivities],
  );

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

  // Latest ACTIVE "Ad Account Sales Setup" record (keyed by adAccountId +
  // customer group) so the card reflects the CURRENT setup. When an account was
  // unassigned and later re-assigned to the same group there are two records —
  // an old Terminated one and a fresh Active one. Only ACTIVE records are
  // considered, and the most recently updated one wins, so a stale/terminated
  // setup never overrides the new active setup on the card.
  const setupRecordByAccountAndGroup = useMemo(() => {
    const map = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Ad Account Sales Setup' || s.status !== 'Active' || !s.adAccountId) return;
      const key = `${s.adAccountId}|${s.groupId}`;
      const existing = map.get(key);
      if (!existing || new Date(s.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
        map.set(key, s);
      }
    });
    return map;
  }, [setups]);

  const getConfiguredSetup = useCallback(
    (acc) => setupRecordByAccountAndGroup.get(`${acc.adAccountId}|${customer?.groupId}`) || null,
    [setupRecordByAccountAndGroup, customer?.groupId],
  );

  // Effective dollar rate for an account: only the Sales Setup configured rate is
  // shown. When no setup exists for the account no rate is displayed at all.
  const getDisplayRate = useCallback(
    (acc) => {
      const configured = getConfiguredSetup(acc)?.dollarRate;
      return Number(configured) > 0 ? configured : null;
    },
    [getConfiguredSetup],
  );

  // Monthly Spending configured in Sales Setup for the account; null when no setup.
  const getDisplayMonthlySpending = useCallback(
    (acc) => {
      const configured = getConfiguredSetup(acc)?.monthlySpending;
      return Number(configured) > 0 ? Number(configured) : null;
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
    setAccountPage(1);
    setActivityPage(1);
  }, [customer?.id, customer?.notes]);

  const accounts = stats?.accounts || [];
  const invoices = stats?.invoices || [];

  // Assigned Ad Accounts filtered by the search box (by name or ID).
  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (acc) =>
        String(acc.adAccountName || '').toLowerCase().includes(q) ||
        String(acc.adAccountId || '').toLowerCase().includes(q),
    );
  }, [accounts, accountSearch]);

  // Per-ad-account Current Month / Last Month topup totals (USD) derived from
  // this customer's invoices so the assigned-account cards can display them.
  const accountTopupTotals = useMemo(() => {
    const now = new Date();
    const curPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const totals = {};
    for (const inv of invoices) {
      const key = inv.adAccountId;
      if (!key) continue;
      if (!totals[key]) totals[key] = { current: 0, last: 0 };
      const prefix = String(inv.date || inv.createdAtRaw || "").slice(0, 7);
      const usd = Number(inv.topupAmountUSD || 0);
      if (prefix === curPrefix) totals[key].current += usd;
      else if (prefix === prevPrefix) totals[key].last += usd;
    }
    return totals;
  }, [invoices]);

  // Monthly Topup Insights calculation
  const monthlyInsights = useMemo(() => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // Get last 6 months of data
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const m = curMonth - i;
      const y = m <= 0 ? curYear - 1 : curYear;
      const mo = m <= 0 ? m + 12 : m;
      months.push(`${y}-${String(mo).padStart(2, '0')}`);
    }

    const monthData = months.map(month => {
      const invs = (stats?.invoices || []).filter(inv => String(inv.date || '').slice(0, 7) === month);
      const totalUSD = invs.reduce((s, inv) => s + (inv.topupAmountUSD || 0), 0);
      const totalBDT = invs.reduce((s, inv) => s + (inv.paidAmountBDT || 0), 0);
      const totalApproved = invs.filter(inv => inv.approvalStatus === 'Approved' && inv.paymentStatus === 'Paid').length;
      const totalInvoices = invs.length;
      const successRatio = totalInvoices > 0 ? Math.round((totalApproved / totalInvoices) * 100) : 0;

      return {
        month,
        totalUSD,
        totalBDT,
        totalInvoices,
        approvedInvoices: totalApproved,
        successRatio,
      };
    });

    // Overall current month stats for success ratio progress bar
    const currentMonthData = monthData.find(m => m.month === `${curYear}-${String(curMonth).padStart(2, '0')}`) || monthData[monthData.length - 1];
    const overallSuccessRatio = currentMonthData?.successRatio || 0;

    // Calculate based on credit limit utilization for success indicator
    const creditLimit = customer?.creditLimitUSD || 1;
    const currentMonthSpend = currentMonthData?.totalUSD || 0;

    return {
      monthData,
      overallSuccessRatio,
      currentMonthData,
      creditLimit,
      currentMonthSpend,
    };
  }, [stats?.invoices, customer?.creditLimitUSD]);

  const accountTotalPages = Math.max(1, Math.ceil(filteredAccounts.length / ACCOUNT_PAGE_SIZE));
  const pagedAccounts = filteredAccounts.slice(
    (accountPage - 1) * ACCOUNT_PAGE_SIZE,
    accountPage * ACCOUNT_PAGE_SIZE,
  );
  const invoiceTotalPages = Math.max(1, Math.ceil(invoices.length / INVOICE_PAGE_SIZE));
  const pagedInvoices = invoices.slice(
    (invoicePage - 1) * INVOICE_PAGE_SIZE,
    invoicePage * INVOICE_PAGE_SIZE,
  );
  const activityTotalPages = Math.max(1, Math.ceil(assignActivities.length / ACTIVITY_PAGE_SIZE));
  const pagedActivities = assignActivities.slice(
    (activityPage - 1) * ACTIVITY_PAGE_SIZE,
    activityPage * ACTIVITY_PAGE_SIZE,
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

  const openUnassignDialog = useCallback((acc) => {
    setUnassignTarget(acc);
    setUnassignReason('');
  }, []);

  const closeUnassignDialog = useCallback(() => {
    if (unassigning) return;
    setUnassignTarget(null);
    setUnassignReason('');
  }, [unassigning]);

  // Persist the unassign with the user-supplied reason, then close the popup.
  const handleConfirmUnassign = async () => {
    if (!unassignTarget || !unassignReason.trim()) return;
    setUnassigning(true);
    try {
      await onUnassignAdAccount(unassignTarget.adAccountId, unassignReason.trim());
      setUnassignTarget(null);
      setUnassignReason('');
    } catch {
      // Error toast is raised by the hook; keep the popup open so the user can retry.
    } finally {
      setUnassigning(false);
    }
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
          Activity / History ({assignActivities.length})
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
              <div className="space-y-4">
                {/* Search assigned ad accounts by name or ID */}
                <div className="relative">
                  <input
                    type="text"
                    value={accountSearch}
                    onChange={(e) => {
                      setAccountSearch(e.target.value);
                      setAccountPage(1);
                    }}
                    placeholder="Search by Ad Account Name / ID..."
                    className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
                  />
                  <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                </div>

                {filteredAccounts.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                    <Layers className="mx-auto mb-2 opacity-40" size={32} />
                    <p className="text-xs">No ad accounts match your search.</p>
                  </div>
                ) : (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pagedAccounts.map((acc) => {
                    const topups = accountTopupTotals[acc.adAccountId] || { current: 0, last: 0 };
                    const setup = getConfiguredSetup(acc);
                    return (
                  <div
                    key={acc.adAccountId}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-white dark:bg-slate-900 shadow-sm hover:shadow-md flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate pr-2">
                          {acc.adAccountName}
                        </h4>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            setup
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          }`}>
                            {setup ? `Sales Setup: ${setup.status}` : 'No Setup'}
                          </span>
                          <span className="text-[10px] text-slate-400">Account: <span className="font-semibold text-slate-600 dark:text-slate-300">{acc.accountStatus}</span></span>
                          <span className="text-[10px] text-slate-400">Platform: <PlatformText platform={acc.platform} className="font-semibold text-[10px]" /></span>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">ID: {acc.adAccountId}</div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/50 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                      <span className="text-slate-400">Dollar Rate: <span className="font-semibold text-slate-600 dark:text-slate-300">{getDisplayRate(acc) !== null ? `৳${getDisplayRate(acc)}` : '—'}</span></span>
                      <span className="text-slate-400">Monthly Spending: <span className="font-semibold text-slate-600 dark:text-slate-300">{getDisplayMonthlySpending(acc) !== null ? `$${getDisplayMonthlySpending(acc).toLocaleString()}` : '—'}</span></span>
                      <span className="text-slate-400">Current Month Topup: <span className="font-semibold text-emerald-600 dark:text-emerald-400">${(topups.current || 0).toLocaleString()}</span></span>
                      <span className="text-slate-400">Last Month Topup: <span className="font-semibold text-slate-600 dark:text-slate-300">${(topups.last || 0).toLocaleString()}</span></span>
                    </div>

                    {!isSalesSetupConfigured(acc) && (
                      <div className="mt-3 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-500/10">
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                          <AlertCircle size={11} className="flex-shrink-0" />
                          Please Setup sales rules for this Ad Account
                        </p>
                        <button
                          type="button"
                          onClick={() => onConfigureSaleSetup(customer.id, acc.adAccountId)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold text-brand-blue dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Configure in Sale Setup <ArrowUpRight size={10} />
                        </button>
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUnassignDialog(acc)}
                        leftIcon={<UserX size={11} />}
                      >
                        Unassign
                      </Button>
                    </div>
                  </div>
                );
                })}
              </div>
              <Pagination page={accountPage} totalPages={accountTotalPages} onPageChange={setAccountPage} />
            </>
            )}

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
                      <th scope="col" className="py-2 px-1.5 sm:px-2.5 font-bold tracking-tight text-[10px] sm:text-xs w-[28%]">Date &amp; Invoice No.</th>
                      <th scope="col" className="py-2 px-1.5 sm:px-2.5 font-bold tracking-tight text-[10px] sm:text-xs w-[32%]">Ad Account Name</th>
                      <th scope="col" className="py-2 px-1 sm:px-2 text-right font-bold tracking-tight text-[10px] sm:text-xs w-[26%]">Amount USD &amp; BDT</th>
                      <th scope="col" className="py-2 px-1 sm:px-2 text-center font-bold tracking-tight text-[10px] sm:text-xs w-[14%]">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {pagedInvoices.map((inv) => (
                      <tr key={inv.invoiceNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-2 px-1.5 sm:px-2.5">
                          <div className="text-slate-600 dark:text-slate-400 font-medium text-[10px] sm:text-xs">{inv.date}</div>
                          <div className="font-mono font-bold text-slate-900 dark:text-white text-[10px] sm:text-xs truncate mt-0.5" title={inv.invoiceNo}>{inv.invoiceNo}</div>
                        </td>
                        <td className="py-2 px-1.5 sm:px-2.5 font-semibold text-slate-800 dark:text-slate-200 text-[10px] sm:text-xs truncate" title={inv.adAccountName}>{inv.adAccountName || '—'}</td>
                        <td className="py-2 px-1 sm:px-2 text-right">
                          <div className="font-black text-slate-900 dark:text-slate-100 text-[10px] sm:text-xs">${(inv.topupAmountUSD || 0).toLocaleString()} USD</div>
                          <div className="font-bold text-slate-700 dark:text-slate-300 text-[10px] sm:text-xs mt-0.5">৳{(inv.paidAmountBDT || 0).toLocaleString()} BDT</div>
                        </td>
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

            {/* Monthly Topup Insights Section */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={14} className="text-brand-blue" />
                <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Monthly Topup Insights</h5>
              </div>

              {/* Success Ratio Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-brand-blue/5 to-brand-orange/5 border border-brand-blue/20 dark:border-brand-blue/10 shadow-sm mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-brand-orange" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Success Ratio — {monthlyInsights.currentMonthData?.month || ''}</span>
                  </div>
                  <span className="text-lg font-black text-brand-blue dark:text-blue-400">{monthlyInsights.overallSuccessRatio}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-brand-blue to-brand-orange transition-all duration-700"
                    style={{ width: `${monthlyInsights.overallSuccessRatio}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">${(monthlyInsights.currentMonthSpend || 0).toLocaleString()} USD spent</span>
                  <span className="text-[10px] text-slate-400">Limit: ${monthlyInsights.creditLimit.toLocaleString()}</span>
                </div>
              </div>

              {/* Monthly Breakdown Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {monthlyInsights.monthData.map((md) => (
                  <div
                    key={md.month}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{md.month}</span>
                      <span className="text-[10px] font-mono font-bold text-brand-blue dark:text-blue-400">{md.totalInvoices} inv.</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">Top-up USD</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">${md.totalUSD.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase">Top-up BDT</p>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">৳{md.totalBDT.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-brand-blue"
                          style={{ width: `${md.successRatio}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">{md.successRatio}%</span>
                    </div>
                  </div>
                ))}
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
            ) : assignActivities.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                <Clock className="mx-auto mb-2 opacity-40" size={32} />
                <p className="text-xs">No assign / unassign activity recorded for this customer yet.</p>
                <p className="text-[10px] mt-1">Account assignment and unassignment logs will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-2.5 pl-3 space-y-5 pb-2">
                  {pagedActivities.map((act) => {
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
                <Pagination page={activityPage} totalPages={activityTotalPages} onPageChange={setActivityPage} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unassign Ad Account Reason popup */}
      <Modal
        isOpen={!!unassignTarget}
        onClose={closeUnassignDialog}
        title="Unassign Ad Account"
        description={unassignTarget ? `Provide a reason before returning ${unassignTarget.adAccountName} to the available pool.` : undefined}
        size="md"
        variant="animated"
      >
        <div className="p-6 space-y-4">
          {unassignTarget && (
            <div className="p-3 rounded-xl bg-surface-blue-light dark:bg-surface-blue-light border border-border-blue-light dark:border-border-blue-light text-xs text-brand-blue-deep dark:text-brand-blue-deep">
              <p className="font-bold">{unassignTarget.adAccountName}</p>
              <p className="mt-0.5">Platform: <span className="font-semibold">{unassignTarget.platform}</span> · ID: <span className="font-mono">{unassignTarget.adAccountId}</span></p>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Reason for Unassign</label>
            <textarea
              id="unassign-reason-input"
              rows={3}
              required
              placeholder="e.g. Customer requested account release / switch to a new account"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={unassignReason}
              onChange={(e) => setUnassignReason(e.target.value)}
            />
            <p className="mt-1 text-[10px] text-slate-400">This reason will be saved and shown in the Activity / History log.</p>
          </div>
          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={closeUnassignDialog} disabled={unassigning}>Cancel</Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleConfirmUnassign}
              disabled={!unassignReason.trim() || unassigning}
              leftIcon={<UserX size={11} />}
            >
              {unassigning ? 'Unassigning...' : 'Unassign Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default memo(CustomerDetailsPane);
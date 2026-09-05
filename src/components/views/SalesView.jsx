'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  CheckCircle,
  Smartphone,
  Globe,
  Layers,
  DollarSign,
  CreditCard,
  Receipt,
  Check,
  ArrowRight,
  ChevronRight,
  Shield,
  RefreshCw,
  Plus,
  FileEdit,
  Upload,
  Image as ImageIcon,
  X as XIcon,
  Copy,
  CopyCheck,
  Download,
  Search,
  History,
  Loader2,
 FileClock,
  CalendarDays,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  XOctagon,
  XCircle,
  MessageSquare,
  AlertCircle,
  ShieldCheck,
  Trash2,
  BarChart3,
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { apiFetch } from '@/utils/api';
import { useInvoicePages } from '@/hooks/useInvoicePages';

const STEP_HEADERS = [
  { id: 1, name: 'Select Customer & Account' },
  { id: 2, name: 'Configure Payment' },
  { id: 3, name: 'Payment Summary' }
];

const ACTION_META = {
  created: { label: 'Entry Created', icon: <FileClock size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  edited: { label: 'Entry Edited', icon: <FileEdit size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  approved: { label: 'Approved', icon: <ThumbsUp size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  rejected: { label: 'Rejected — Waiting for Feedback', icon: <ThumbsDown size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  feedback_submitted: { label: 'Feedback Submitted', icon: <MessageSquare size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  final_approved: { label: 'Final Approval Granted', icon: <CheckCheck size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  final_rejected: { label: 'Finally Rejected', icon: <XOctagon size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  status_synced: { label: 'Topup Status Synced', icon: <RefreshCw size={13} />, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400' },
};

function formatActor(actor) {
  if (!actor) return 'System';
  return actor.name || actor.email || actor.uid || 'System';
}

function auditLogOf(inv) {
  return Array.isArray(inv?.auditLog) ? inv.auditLog : [];
}

function SalesView({
  customers,
  socialAdAccounts = [],
  invoices = [],
  setups = [],
  paymentMethods,
  onSubmitSale,
  onAddHistoricalSale,
  onUpdateInvoice,
  onDeleteInvoice,
  onNavigateToCustomers,
  loading = false,
  initialCheckoutStep,
  initialCustomerId,
  defaultDollarRate,
}) {
  const [currentStep, setCurrentStep] = useState(initialCheckoutStep ?? 1);
  
  // Service Type & Group ID Code
  const [serviceType, setServiceType] = useState('');
  const [groupIdCode, setGroupIdCode] = useState('');
  // Group ID search box — the selected group is never pre-populated; the user
  // must manually pick a Group ID (see "Please select a Group ID" prompt).
  const [groupIdSearch, setGroupIdSearch] = useState('');

  // Build deduplicated list of available Group IDs (the canonical source is the
  // customer records — a sale's groupId is always copied from its customer).
  const groupIdOptions = React.useMemo(() => {
    const ids = new Set();
    customers.forEach(c => { if (c.groupId) ids.add(c.groupId); });
    return Array.from(ids).sort();
  }, [customers]);

  // Customers belonging to the selected group
  const customersInGroup = React.useMemo(
    () => customers.filter(c => !groupIdCode || c.groupId === groupIdCode),
    [customers, groupIdCode]
  );

  // Group IDs filtered by the search term typed into the Group ID search box
  const filteredGroupOptions = React.useMemo(() => {
    const q = groupIdSearch.trim().toLowerCase();
    if (!q) return groupIdOptions;
    return groupIdOptions.filter(id => id.toLowerCase().includes(q));
  }, [groupIdOptions, groupIdSearch]);

  const handleSelectGroup = (gid) => {
    setGroupIdCode(gid);
    setGroupIdSearch(gid);
    const inGroup = customers.filter(c => c.groupId === gid);
    const keep = inGroup.find(c => c.id === selectedCustomerId);
    setSelectedCustomerId(keep ? keep.id : (inGroup[0] ? inGroup[0].id : ''));
    setValidationError('');
  };

  const handleClearGroup = () => {
    setGroupIdCode('');
    setGroupIdSearch('');
    setSelectedCustomerId('');
  };

  // Live preview of the next invoice number (DB-backed, read without consuming it)
  const [previewInvoiceNo, setPreviewInvoiceNo] = useState('');
  useEffect(() => {
    apiFetch('/api/invoices/next-no')
      .then((data) => { if (data?.invoiceNo) setPreviewInvoiceNo(data.invoiceNo); })
      .catch(() => {});
  }, []);

  // Edit record modal state
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);

  // View Log modal state
  const [logTarget, setLogTarget] = useState(null);

  // Delete Sales Entry Record confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Per-record Copy Invoice feedback
  const [copiedRecord, setCopiedRecord] = useState('');

  // Sales records: server-side paginated via `useInvoicePages` — only the
  // current page (+ the collection-wide aggregates) is ever loaded into the
  // browser, so the Sales Entry table no longer pulls the entire invoice
  // collection down just to render 8 rows.
  const RECORDS_PER_PAGE = 8;
  const salesInvoicePages = useInvoicePages({ initialLimit: RECORDS_PER_PAGE });
  const totalPages = salesInvoicePages.totalPages;
  const clampedPage = salesInvoicePages.page;
  const paginatedInvoices = salesInvoicePages.rows;
  const salesLoading = salesInvoicePages.loading;
  const salesInvoiceError = salesInvoicePages.error;

  // Sales Entry Records — Date-wise / Month-wise filters (above the table).
  // Date-wise supports a single date (From only) or a range (From + To).
  // Month-wise filters by YYYY-MM. Month and date filters are mutually exclusive.
  const [salesDateFrom, setSalesDateFrom] = useState('');
  const [salesDateTo, setSalesDateTo] = useState('');
  const [salesMonth, setSalesMonth] = useState('');
  const [salesInvoiceNoSearch, setSalesInvoiceNoSearch] = useState('');

  const salesRecordsHasActiveFilter = !!(salesDateFrom || salesDateTo || salesMonth || salesInvoiceNoSearch);

  const applySalesDateFilter = useCallback((nextFrom, nextTo, invoiceNo) => {
    const filters = {};
    if (salesMonth) filters.month = salesMonth;
    if (nextFrom && nextTo) {
      if (nextFrom === nextTo) {
        filters.date = nextFrom;
      } else {
        const from = nextFrom < nextTo ? nextFrom : nextTo;
        const to = nextFrom < nextTo ? nextTo : nextFrom;
        filters.dateFrom = from;
        filters.dateTo = to;
      }
    } else if (nextFrom) {
      filters.date = nextFrom;
    } else if (nextTo) {
      filters.date = nextTo;
    }
    if (invoiceNo) filters.invoiceNo = invoiceNo;
    salesInvoicePages.setFilters(filters);
  }, [salesMonth, salesInvoicePages]);

  const handleSalesInvoiceNoSearch = useCallback((val) => {
    setSalesInvoiceNoSearch(val);
    const filters = {};
    if (salesMonth) filters.month = salesMonth;
    if (salesDateFrom && salesDateTo) {
      if (salesDateFrom === salesDateTo) {
        filters.date = salesDateFrom;
      } else {
        const from = salesDateFrom < salesDateTo ? salesDateFrom : salesDateTo;
        const to = salesDateFrom < salesDateTo ? salesDateTo : salesDateFrom;
        filters.dateFrom = from;
        filters.dateTo = to;
      }
    } else if (salesDateFrom) {
      filters.date = salesDateFrom;
    } else if (salesDateTo) {
      filters.date = salesDateTo;
    }
    if (val.trim()) filters.invoiceNo = val.trim();
    salesInvoicePages.setFilters(filters);
  }, [salesMonth, salesDateFrom, salesDateTo, salesInvoicePages]);

  const handleSalesDateFromChange = useCallback((val) => {
    setSalesDateFrom(val);
    if (val) setSalesMonth('');
    const nextFrom = val;
    const nextTo = salesDateTo;
    if (!nextFrom && !nextTo) {
      const filters = {};
      if (salesInvoiceNoSearch.trim()) filters.invoiceNo = salesInvoiceNoSearch.trim();
      salesInvoicePages.setFilters(filters);
      return;
    }
    applySalesDateFilter(nextFrom, nextTo, salesInvoiceNoSearch.trim() || undefined);
  }, [salesDateTo, applySalesDateFilter, salesInvoicePages, salesInvoiceNoSearch]);

  const handleSalesDateToChange = useCallback((val) => {
    setSalesDateTo(val);
    if (val) setSalesMonth('');
    const nextFrom = salesDateFrom;
    const nextTo = val;
    if (!nextFrom && !nextTo) {
      const filters = {};
      if (salesInvoiceNoSearch.trim()) filters.invoiceNo = salesInvoiceNoSearch.trim();
      salesInvoicePages.setFilters(filters);
      return;
    }
    applySalesDateFilter(nextFrom, nextTo, salesInvoiceNoSearch.trim() || undefined);
  }, [salesDateFrom, applySalesDateFilter, salesInvoicePages, salesInvoiceNoSearch]);

  const handleSalesMonthChange = useCallback((val) => {
    setSalesMonth(val);
    if (val) {
      setSalesDateFrom('');
      setSalesDateTo('');
      const filters = { month: val };
      if (salesInvoiceNoSearch.trim()) filters.invoiceNo = salesInvoiceNoSearch.trim();
      salesInvoicePages.setFilters(filters);
    } else {
      const filters = {};
      if (salesInvoiceNoSearch.trim()) filters.invoiceNo = salesInvoiceNoSearch.trim();
      salesInvoicePages.setFilters(filters);
    }
  }, [salesInvoicePages, salesInvoiceNoSearch]);

  const clearSalesEntryFilters = useCallback(() => {
    setSalesDateFrom('');
    setSalesDateTo('');
    setSalesMonth('');
    setSalesInvoiceNoSearch('');
    salesInvoicePages.setFilters({});
  }, [salesInvoicePages]);

  // Ad Account Search — verification panel: searches the real Sales Entry data
  // by Ad Account ID or Ad Account Name and lists every date on which a sales
  // entry was recorded for that account so missing/incorrect entries are easy
  // to spot. Read-only; it never touches existing Sales Entry logic.
  const [adAccountSearch, setAdAccountSearch] = useState('');
  const [adAccountSearchResults, setAdAccountSearchResults] = useState(null);
  const [adAccountSearchLoading, setAdAccountSearchLoading] = useState(false);
  const [adAccountSearchError, setAdAccountSearchError] = useState('');
  const [adAccountSearchRan, setAdAccountSearchRan] = useState(false);

  const runAdAccountSearch = useCallback(async (rawQuery) => {
    const q = (rawQuery ?? adAccountSearch).trim();
    if (!q) {
      setAdAccountSearchError('Please enter an Ad Account ID or Ad Account Name to search.');
      setAdAccountSearchResults(null);
      setAdAccountSearchRan(false);
      return;
    }
    let cancelled = false;
    setAdAccountSearchLoading(true);
    setAdAccountSearchError('');
    try {
      const params = new URLSearchParams({ q });
      const data = await apiFetch(`/api/sales/search?${params.toString()}`);
      if (!cancelled) {
        setAdAccountSearchResults(data || null);
        setAdAccountSearchRan(true);
      }
    } catch (err) {
      if (!cancelled) {
        setAdAccountSearchError(err?.message || 'Search failed. Please try again.');
        setAdAccountSearchResults(null);
        setAdAccountSearchRan(true);
      }
    } finally {
      if (!cancelled) setAdAccountSearchLoading(false);
    }
    return () => { cancelled = true; };
  }, [adAccountSearch]);

  const clearAdAccountSearch = () => {
    setAdAccountSearch('');
    setAdAccountSearchResults(null);
    setAdAccountSearchError('');
    setAdAccountSearchRan(false);
  };

  // Sales Entry Report — aggregated, read-only reports (day-wise / month-wise
  // entry counts + sales amounts) built from the real Sales Entry data.
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState('dayWiseEntries');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const REPORT_TABS = [
    { id: 'dayWiseEntries', label: 'Day-Wise Sales Entry/Amount Report', groupBy: 'day', mode: 'entries' },
    { id: 'monthWiseEntries', label: 'Monthly Sales Entry/Amount Report', groupBy: 'month', mode: 'entries' },
    // { id: 'dayWiseAmount', label: 'Day-Wise Sales Amount', groupBy: 'day', mode: 'amount' },
    // { id: 'monthWiseAmount', label: 'Monthly Sales Amount', groupBy: 'month', mode: 'amount' },
  ];

  const toggleReport = async () => {
    const next = !showReport;
    setShowReport(next);
    if (!next || reportData) return;
    let cancelled = false;
    setReportLoading(true);
    setReportError('');
    try {
      const data = await apiFetch('/api/sales/report');
      if (!cancelled) setReportData(data || null);
    } catch (err) {
      if (!cancelled) setReportError(err?.message || 'Failed to load the sales entry report.');
    } finally {
      if (!cancelled) setReportLoading(false);
    }
  };

  // Windowed pagination (same pattern as the invoices page): show the first page,
  // a few pages around the current one, the last page, and collapse the rest with
  // an ellipsis instead of rendering every page number side by side.
  const pageWindow = (() => {
    const pages = [];
    const max = totalPages;
    const current = clampedPage;
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(max - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < max - 2) pages.push('...');
    if (max > 1) pages.push(max);
    return pages;
  })();

  // Checkout State
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');

  // Real topup totals fetched from the customer's topup history in the database
  const [topupSummary, setTopupSummary] = useState(null);
  const [topupSummaryLoading, setTopupSummaryLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!selectedCustomerId) {
      setTopupSummary(null);
      setTopupSummaryLoading(false);
      return undefined;
    }
    setTopupSummaryLoading(true);
    apiFetch(`/api/customers/${encodeURIComponent(selectedCustomerId)}/topup-summary`)
      .then((data) => { if (!cancelled) setTopupSummary(data?.summary || null); })
      .catch(() => { if (!cancelled) setTopupSummary(null); })
      .finally(() => { if (!cancelled) setTopupSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [selectedCustomerId]);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  const [validationError, setValidationError] = useState('');

  // Sale Entry Date — manually selected by the user and saved with the Sales Entry
  const [saleDate, setSaleDate] = useState('');

  // Calculations State
  const [dollarRate, setDollarRate] = useState(132);
  const [topupAmountUSD, setTopupAmountUSD] = useState('');
  const [othersTotalAmount, setOthersTotalAmount] = useState('');
  const [totalBDT, setTotalBDT] = useState(0);
  const [paidBDT, setPaidBDT] = useState('');
  const [dueBDT, setDueBDT] = useState(0);
  
  // Payment Details State
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [topupStatus, setTopupStatus] = useState('Successfull');
  const [workingStatus, setWorkingStatus] = useState('Assigned');
  const [assignEmployee, setAssignEmployee] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('Pending');
  const [noteText, setNoteText] = useState('');

  // Payment Screenshots — up to 3 (at least 1 required).
  // Each entry: { slot: number, data: string (data URL), name: string }
  const [paymentScreenshots, setPaymentScreenshots] = useState([]);
  const [screenshotError, setScreenshotError] = useState('');

  // Backward-compatible aliases (first screenshot) consumed by the review step.
  const paymentScreenshot = paymentScreenshots[0]?.data;
  const screenshotName = paymentScreenshots[0]?.name || '';

  const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleScreenshotUpload = (slot) => (e) => {
    setScreenshotError('');
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setScreenshotError('Please upload a valid image file (PNG, JPG, JPEG, WebP, GIF).');
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      setScreenshotError(`Image is too large. Maximum allowed size is 5 MB (uploaded: ${(file.size / 1024 / 1024).toFixed(2)} MB).`);
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const data = typeof reader.result === 'string' ? reader.result : undefined;
      if (e.target) e.target.value = '';
      setPaymentScreenshots((prev) => {
        const next = prev.filter((s) => s.slot !== slot);
        next.push({ slot, data, name: file.name });
        return next.sort((a, b) => a.slot - b.slot);
      });
    };
    reader.onerror = () => {
      setScreenshotError('Failed to read the uploaded file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = (slot) => () => {
    setPaymentScreenshots((prev) => prev.filter((s) => s.slot !== slot));
    setScreenshotError('');
  };

  // Safety guard state to prevent click-through double-triggering or fast keypress form submission when entering step 3
  const [canSubmit, setCanSubmit] = useState(false);
  useEffect(() => {
    if (currentStep === 3) {
      setCanSubmit(false);
      const timer = setTimeout(() => {
        setCanSubmit(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCanSubmit(false);
    }
  }, [currentStep]);

  // Selected entities
  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  // Merge social accounts (loaded from the Ad Account Inventory page) with the main
  // inventory so accounts from BOTH collections can be used in the checkout flow.
  const allAccounts = useMemo(() => [...(socialAdAccounts || [])], [socialAdAccounts]);

  // Accounts assigned to the selected customer (any platform). The platform is
  // determined automatically from the chosen ad account, not selected manually.
  const customerAccounts = allAccounts.filter(acc =>
    acc.assignedCustomer === selectedCustomerId
  );

  // True when the customer actually paid something (Paid Amount > 0)
  const hasPaidAmount = Number.isFinite(paidBDT) && paidBDT > 0;

  // Active "Ad Account Sales Setup" records keyed by adAccountId. The rate/values
  // configured on /sale-setup must win over the account's bootstrap values.
  const saleSetupByAccount = useMemo(() => {
    const index = new Map();
    const byGroup = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Ad Account Sales Setup' || s.status !== 'Active' || !s.adAccountId) return;
      if (!index.has(s.adAccountId)) index.set(s.adAccountId, s);
      const gk = `${s.adAccountId}|${s.groupId}`;
      if (!byGroup.has(gk)) byGroup.set(gk, s);
    });
    return { index, byGroup };
  }, [setups]);

  // Active "Others Sale Setup" records keyed by groupId. When the service
  // type is "Others", the configured service fee and details from this
  // lookup are applied to the sale entry.
  const othersSetupByGroup = useMemo(() => {
    const map = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Others Sale Setup' || s.status !== 'Active') return;
      const key = s.groupId;
      if (!map.has(key)) map.set(key, s);
    });
    return map;
  }, [setups]);

  // All active "Others Sale Setup" records grouped by groupId. A single group
  // can contain multiple services, so the sale flow lets the user pick the
  // specific service they want (see "Select Service" in Step 1).
  const othersSetupListByGroup = useMemo(() => {
    const map = new Map();
    (setups || []).forEach((s) => {
      if (s.serviceType !== 'Others Sale Setup' || s.status !== 'Active') return;
      const key = s.groupId;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }, [setups]);

  const othersServiceKeyOf = (s) => String(s?.id ?? `${s?.service || ''}||${s?.serviceDetails || ''}||${s?.serviceFee ?? ''}`);

  // The specific Others service the user picked from the selected group.
  const [selectedOthersServiceId, setSelectedOthersServiceId] = useState('');

  // Service options available for the currently selected Other Service Group.
  const othersServiceOptions = useMemo(() => {
    if (serviceType !== 'Others' || !groupIdCode) return [];
    return othersSetupListByGroup.get(groupIdCode) || [];
  }, [serviceType, groupIdCode, othersSetupListByGroup]);

  // Default to the first service in the group; keep the selection while it is
  // still part of the group, and clear it when the group has no services.
  useEffect(() => {
    if (serviceType !== 'Others' || !groupIdCode) {
      setSelectedOthersServiceId('');
      return;
    }
    const list = othersSetupListByGroup.get(groupIdCode) || [];
    if (list.length === 0) {
      setSelectedOthersServiceId('');
      return;
    }
    const stillValid = list.some((s) => othersServiceKeyOf(s) === selectedOthersServiceId);
    if (!stillValid) setSelectedOthersServiceId(othersServiceKeyOf(list[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceType, groupIdCode, othersSetupListByGroup]);

  // The configured Sales Setup for an account: exact customer-group match wins,
  // otherwise fall back to any active setup for that account.
  const getConfiguredSetupFor = useCallback(
    (acc) => {
      if (!acc) return null;
      const { index, byGroup } = saleSetupByAccount;
      if (activeCustomer?.groupId) {
        const groupMatch = byGroup.get(`${acc.adAccountId}|${activeCustomer.groupId}`);
        if (groupMatch) return groupMatch;
      }
      return index.get(acc.adAccountId) || null;
    },
    [saleSetupByAccount, activeCustomer?.groupId],
  );

  // The configured Others Sale Setup for the selected group, used when
  // serviceType is "Others" to obtain the service fee and details.
  const getConfiguredOthersSetupForGroup = useCallback(
    (gid) => {
      if (!gid) return null;
      return othersSetupByGroup.get(gid) || null;
    },
    [othersSetupByGroup],
  );

  // Effective dollar rate for an account: the Sale Setup configured rate wins
  // (mirrors the Customers page so the same rules appear across the app).
  const getEffectiveRate = useCallback(
    (acc) => {
      const configured = getConfiguredSetupFor(acc)?.dollarRate;
      return Number(configured) > 0 ? configured : acc?.dollarRate || 132;
    },
    [getConfiguredSetupFor],
  );

  // Auto-set the first account when the customer changes (platform follows the
  // selected ad account automatically).
  useEffect(() => {
    if (customerAccounts.length > 0) {
      setSelectedAccountId(customerAccounts[0].adAccountId);
      setDollarRate(getEffectiveRate(customerAccounts[0]));
    } else {
      setSelectedAccountId('');
      setDollarRate(132);
    }
  }, [selectedCustomerId]);

  // When selected account changes, update the loaded rate
  const activeAccount = allAccounts.find(acc => acc.adAccountId === selectedAccountId);

  // Platform is derived automatically from the selected Ad Account's data.
  const platform = activeAccount?.platform || '';

  const activeAccountSetup = getConfiguredSetupFor(activeAccount);

  // On-demand fetch of the active account's invoices for the "Topups Since
  // Assignment" panel. We scope it on the server by customer + adAccount (capped
  // at 200, which is far beyond any realistic per-account count) instead of
  // filtering the whole collection in the browser.
  const [accountInvoices, setAccountInvoices] = useState([]);
  const [accountInvoicesLoading, setAccountInvoicesLoading] = useState(false);
  useEffect(() => {
    if (!activeAccount || !selectedCustomerId) {
      setAccountInvoices([]);
      return;
    }
    let cancelled = false;
    setAccountInvoicesLoading(true);
    const params = new URLSearchParams({
      customerId: selectedCustomerId,
      adAccountId: activeAccount.adAccountId,
      limit: '200',
    });
    apiFetch(`/api/invoices?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setAccountInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      })
      .catch(() => { if (!cancelled) setAccountInvoices([]); })
      .finally(() => { if (!cancelled) setAccountInvoicesLoading(false); });
    return () => { cancelled = true; };
  }, [activeAccount, selectedCustomerId]);

  // Topups taken by the selected account AFTER it was assigned to this customer
  const matchingAccountInvoices = React.useMemo(() => {
    if (!activeAccount || !selectedCustomerId) return [];
    const assignedAt = activeAccount.assignedAt ? new Date(activeAccount.assignedAt).getTime() : null;
    return accountInvoices.filter(inv => {
      // accountInvoices is already scoped to this adAccount + customer server-side,
      // so we only need to enforce the assignment-date boundary locally.
      if (assignedAt) {
        const invTime = inv.createdAtRaw
          ? new Date(inv.createdAtRaw).getTime()
          : inv.date
          ? new Date(inv.date).getTime()
          : 0;
        if (!Number.isNaN(invTime) && invTime < assignedAt) return false;
      }
      return true;
    });
  }, [activeAccount, selectedCustomerId, accountInvoices]);

  useEffect(() => {
    if (activeAccount) {
      const rate = getEffectiveRate(activeAccount);
      setDollarRate(rate);
    }
  }, [selectedAccountId, activeAccount, activeAccountSetup]);

  // Look up the "Others Sale Setup" for the currently selected group so
  // that the service fee and details from the setup are available in the
  // sale flow. When the group contains multiple services, the one picked in
  // "Select Service" wins; otherwise the first active setup is used.
  const othersSetup = useMemo(() => {
    if (serviceType !== 'Others' || !groupIdCode) return null;
    const list = othersSetupListByGroup.get(groupIdCode) || [];
    if (list.length > 0) {
      return list.find((s) => othersServiceKeyOf(s) === selectedOthersServiceId) || list[0];
    }
    return getConfiguredOthersSetupForGroup(groupIdCode);
  }, [serviceType, groupIdCode, othersSetupListByGroup, selectedOthersServiceId, getConfiguredOthersSetupForGroup]);

  // When serviceType is "Others", totalBDT is driven by the service fee
  // from the Others Sale Setup instead of topupAmountUSD × dollarRate.
  useEffect(() => {
    if (serviceType === 'Others') {
      setTotalBDT(Math.round(Number(othersTotalAmount || 0) * 100) / 100);
    } else {
      const total = Math.round(topupAmountUSD * dollarRate * 100) / 100;
      setTotalBDT(total);
    }
  }, [topupAmountUSD, dollarRate, serviceType, othersTotalAmount]);

  useEffect(() => {
    if (serviceType === 'Others') {
      const configuredAmount = Number(othersSetup?.serviceFee);
      setOthersTotalAmount(configuredAmount > 0 ? Math.round(configuredAmount * 100) / 100 : '');
    }
  }, [serviceType, othersSetup]);

  // Handle live calculations (skip when serviceType is Others — totalBDT is driven by serviceFee)
  useEffect(() => {
    if (serviceType !== 'Others') {
      const total = Math.round(topupAmountUSD * dollarRate * 100) / 100;
      setTotalBDT(total);
    }
  }, [topupAmountUSD, dollarRate, serviceType]);

  useEffect(() => {
    const due = Math.round((totalBDT - paidBDT) * 100) / 100;
    setDueBDT(due);
  }, [totalBDT, paidBDT]);

  // Payment status badge driven by what the customer actually paid vs the full BDT total
  const paymentStatusBadge = useMemo(() => {
    if (totalBDT <= 0) {
      return { label: '\u2014', color: 'text-slate-400' };
    }
    if (dueBDT <= 0 && paidBDT > 0) {
      return { label: 'Paid', color: 'text-emerald-600 dark:text-emerald-400' };
    }
    if (paidBDT > 0 && paidBDT < totalBDT) {
      return { label: 'Partially Paid', color: 'text-amber-600 dark:text-amber-400' };
    }
    if (paidBDT <= 0) {
      return { label: 'Due', color: 'text-rose-600 dark:text-rose-400' };
    }
    return { label: 'Due', color: 'text-rose-600 dark:text-rose-400' };
  }, [totalBDT, paidBDT, dueBDT]);

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!serviceType) {
        setValidationError('Please select a service type before continuing.');
        return;
      }
      if (!groupIdCode) {
        setValidationError('Please select a Group ID before continuing.');
        return;
      }
      if (!selectedCustomerId) {
        setValidationError('Please select a customer before continuing.');
        return;
      }
      if (serviceType !== 'Others' && !selectedAccountId) {
        setValidationError('Please select a target ad account before continuing.');
        return;
      }
      setValidationError('');
    }

    if (currentStep === 2) {
      if (serviceType === 'Others' && (!othersTotalAmount || othersTotalAmount <= 0)) {
        setValidationError('Please enter a valid total amount (greater than 0).');
        return;
      }
      if (serviceType !== 'Others' && (!topupAmountUSD || topupAmountUSD <= 0)) {
        setValidationError('Please enter a valid amount the customer paid (greater than 0).');
        return;
      }
      if (!hasPaidAmount) {
        if (!noteText || !noteText.trim()) {
          setValidationError('An Author Note is required when no amount is paid (Paid Amount is empty or 0).');
          return;
        }
      }
      if (paymentScreenshots.length === 0) {
        setValidationError('Please upload at least one payment screenshot before continuing.');
        return;
      }
      setValidationError('');
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    setValidationError('');
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleStepClick = (stepId) => {
    if (stepId === currentStep) return;

    // Backward navigation is always allowed
    if (stepId < currentStep) {
      setValidationError('');
      setCurrentStep(stepId);
      return;
    }

    // Forward navigation requires validation of intermediate steps
    let tempStep = currentStep;
    while (tempStep < stepId) {
      if (tempStep === 1) {
        if (!serviceType) {
          setValidationError('Please select a service type before continuing.');
          return;
        }
        if (!groupIdCode) {
          setValidationError('Please select a Group ID before continuing.');
          return;
        }
        if (!selectedCustomerId) {
          setValidationError('Please select a customer before continuing.');
          return;
        }
        if (serviceType !== 'Others' && !selectedAccountId) {
          setValidationError('Please select a target ad account before continuing.');
          return;
        }
      }

      if (tempStep === 2) {
        if (serviceType === 'Others' && (!othersTotalAmount || othersTotalAmount <= 0)) {
          setValidationError('Please enter a valid total amount (greater than 0).');
          return;
        }
        if (serviceType !== 'Others' && (!topupAmountUSD || topupAmountUSD <= 0)) {
          setValidationError('Please enter a valid amount the customer paid (greater than 0).');
          return;
        }
        if (!hasPaidAmount) {
          if (!noteText || !noteText.trim()) {
            setValidationError('An Author Note is required when no amount is paid (Paid Amount is empty or 0).');
            return;
          }
        }
        if (paymentScreenshots.length === 0) {
          setValidationError('Please upload at least one payment screenshot before continuing.');
          return;
        }
      }

      tempStep++;
    }

    setValidationError('');
    setCurrentStep(stepId);
  };

  const handleCheckoutSubmit = (e) => {
    e.preventDefault();
    if (currentStep < 3) {
      handleNextStep();
      return;
    }
    if (!canSubmit) return;
    if (!selectedCustomerId || (serviceType !== 'Others' && !selectedAccountId)) return;

    onSubmitSale({
      platform: serviceType === 'Others' ? undefined : platform,
      date: saleDate || undefined,
      customerId: selectedCustomerId,
      groupId: groupIdCode,
      serviceType,
      adAccountName: serviceType === 'Others' ? undefined : (activeAccount?.adAccountName || "Unknown Account"),
      adAccountId: serviceType === 'Others' ? undefined : selectedAccountId,
      ...(serviceType === 'Others'
        ? {
            workingStatus,
            assignEmployee: assignEmployee.trim() || undefined,
          }
        : {
            dollarRate,
            topupAmountUSD,
            topupStatus,
          }),
      totalAmountBDT: totalBDT,
      paidAmountBDT: Number.isFinite(paidBDT) ? paidBDT : 0,
      dueAmountBDT: Number.isFinite(dueBDT) ? dueBDT : 0,
      paymentStatus: dueBDT <= 0 ? 'Paid' : paidBDT > 0 ? 'Partially Paid' : 'Due',
      paymentMethod,
      approvalStatus,
      paymentScreenshot,
      screenshotName: screenshotName || undefined,
      screenshots: paymentScreenshots.map((s) => ({
        url: s.data,
        name: s.name,
        source: 'payment',
      })),
      serviceDetails: serviceType === 'Others' ? (othersSetup?.service || '') : undefined,
      serviceFee: serviceType === 'Others' && othersSetup ? Number(othersSetup.serviceFee) : undefined,
      note: noteText || undefined
    });

    // Reset checkout state
    setCurrentStep(1);
    setSaleDate('');
    setTopupAmountUSD('');
    setOthersTotalAmount('');
    setPaidBDT('');
    setWorkingStatus('Assigned');
    setAssignEmployee('');
    setNoteText('');
    setPaymentScreenshots([]);
    setScreenshotError('');
  };

  // STEP 4 — HISTORICAL / PREVIOUS MONTH SALES ENTRY
  // Self-contained state so the backfill flow can never touch the live checkout.
  const [showHistModal, setShowHistModal] = useState(false);
  const [histSubmitting, setHistSubmitting] = useState(false);
  const [histError, setHistError] = useState('');
  const [histDate, setHistDate] = useState('');
  const [histServiceType, setHistServiceType] = useState('Ad Account Topup');
  const [histGroupId, setHistGroupId] = useState('');
  const [histCustomerId, setHistCustomerId] = useState('');
  // Every payment gateway that is available for selection: the configured
  // settings payment methods plus any method already recorded against a
  // sales entry (those recorded via free-text entries).
  const availablePaymentMethods = React.useMemo(() => {
    const methods = new Set((paymentMethods || []).map(m => String(m).trim()).filter(Boolean));
    (invoices || []).forEach(inv => {
      const method = String(inv.paymentMethod || '').trim();
      if (method) methods.add(method);
    });
    return Array.from(methods);
  }, [paymentMethods, invoices]);

  const [histPlatform, setHistPlatform] = useState('Facebook');
  const [histAdAccountName, setHistAdAccountName] = useState('');
  const [histAdAccountId, setHistAdAccountId] = useState('');
  const [histDollarRate, setHistDollarRate] = useState(Number(defaultDollarRate) > 0 ? Number(defaultDollarRate) : 132);
  const [histTopupUSD, setHistTopupUSD] = useState('');
  const [histPaidBDT, setHistPaidBDT] = useState('');
  const [histPaymentMethod, setHistPaymentMethod] = useState(availablePaymentMethods[0] ?? '');
  const [histTopupStatus, setHistTopupStatus] = useState('Successfull');
  const [histNote, setHistNote] = useState('');

  const histUsd = Number(histTopupUSD);
  const histTotalBdt = Math.round((Number.isFinite(histUsd) ? histUsd : 0) * (Number(histDollarRate) || 0) * 100) / 100;
  const histPaid = Number(histPaidBDT);
  const histDue = Math.round((histTotalBdt - (Number.isFinite(histPaid) ? histPaid : 0)) * 100) / 100;
  const histPaymentStatus = histDue <= 0 && histPaid > 0 ? 'Paid' : histPaid > 0 ? 'Partially Paid' : 'Due';
  const histMaxDate = new Date().toISOString().split('T')[0];

  const resetHistForm = () => {
    setHistDate('');
    setHistServiceType('Ad Account Topup');
    setHistGroupId('');
    setHistCustomerId('');
    setHistPlatform('Facebook');
    setHistAdAccountName('');
    setHistAdAccountId('');
    setHistDollarRate(Number(defaultDollarRate) > 0 ? Number(defaultDollarRate) : 132);
    setHistTopupUSD('');
    setHistPaidBDT('');
    setHistPaymentMethod(availablePaymentMethods[0] ?? '');
    setHistTopupStatus('Successfull');
    setHistNote('');
    setHistError('');
    setHistSubmitting(false);
  };

  const openHistModal = () => {
    resetHistForm();
    setShowHistModal(true);
  };

  const handleAddHistoricalSale = async (e) => {
    e.preventDefault();
    setHistError('');

    const date = histDate;
    if (!date) {
      setHistError('Please select the historical sale date.');
      return;
    }
    const chosen = new Date(`${date}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(chosen.getTime())) {
      setHistError('Please enter a valid date.');
      return;
    }
    if (chosen.getTime() >= today.getTime()) {
      setHistError('Historical sales must be for a past date (before today).');
      return;
    }

    if (!histServiceType) {
      setHistError('Please select a service type.');
      return;
    }
    if (!histGroupId) {
      setHistError('Please select a Group ID.');
      return;
    }
    if (!histCustomerId) {
      setHistError('Please select a customer.');
      return;
    }
    if (!histAdAccountName.trim()) {
      setHistError('Please enter the ad account name.');
      return;
    }
    if (histServiceType !== 'Others' && !histAdAccountId.trim()) {
      setHistError('Please enter the ad account ID.');
      return;
    }

    const usd = Number(histTopupUSD);
    if (!Number.isFinite(usd) || usd <= 0) {
      setHistError('Please enter a valid topup amount (USD) greater than 0.');
      return;
    }
    const paid = Number(histPaidBDT);
    if (!Number.isFinite(paid) || paid < 0) {
      setHistError('Please enter a valid paid amount (BDT).');
      return;
    }
    if (paid <= 0 && !histNote.trim()) {
      setHistError('An Author Note is required when no amount is paid.');
      return;
    }

    if (!onAddHistoricalSale) {
      setHistError('Historical sale entry is not available right now.');
      return;
    }
    if (histSubmitting) return;
    setHistSubmitting(true);

    const due = Math.round((histTotalBdt - paid) * 100) / 100;
    const paymentStatus = due <= 0 && paid > 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Due';

    try {
      await onAddHistoricalSale({
        date,
        serviceType: histServiceType,
        groupId: histGroupId,
        customerId: histCustomerId,
        platform: histPlatform,
        adAccountName: histAdAccountName.trim(),
        adAccountId: histAdAccountId.trim(),
        dollarRate: Number(histDollarRate) || 0,
        topupAmountUSD: usd,
        totalAmountBDT: histTotalBdt,
        paidAmountBDT: paid,
        dueAmountBDT: due,
        paymentStatus,
        paymentMethod: histPaymentMethod,
        topupStatus: histTopupStatus,
        approvalStatus: 'Approved',
        note: histNote.trim() || undefined,
        ...(histServiceType === 'Others' && (() => {
          const histOthersSetup = othersSetupByGroup.get(histGroupId) || null;
          return {
            serviceDetails: histOthersSetup?.service || undefined,
            serviceFee: histOthersSetup ? Number(histOthersSetup.serviceFee) : undefined,
          };
        })()),
      });
      setShowHistModal(false);
      resetHistForm();
    } catch (err) {
      // Error toast is raised by the hook/context.
    } finally {
      setHistSubmitting(false);
    }
  };

  // STEP 5 — LIVE CHECKOUT INVOICE copy
  const [copied, setCopied] = useState(false);

  // PDF invoice download — Other Services only. Builds the invoice from the
  // current checkout draft and downloads a server-generated PDF. Never used
  // for Ad Account Topup sales, so existing invoice functionality is untouched.
  const [downloadingOthersInvoice, setDownloadingOthersInvoice] = useState(false);
  const [othersInvoiceError, setOthersInvoiceError] = useState('');

  const handleDownloadOthersInvoice = async () => {
    if (serviceType !== 'Others') return;
    if (downloadingOthersInvoice) return;
    setDownloadingOthersInvoice(true);
    setOthersInvoiceError('');
    try {
      const res = await fetch('/api/sales/others-invoice-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceType: 'Others',
          invoiceNo: previewInvoiceNo || undefined,
          date: saleDate || new Date().toISOString().split('T')[0],
          groupId: groupIdCode,
          customerId: activeCustomer?.id,
          customerName: activeCustomer?.name,
          companyName: activeCustomer?.companyName,
          service: othersSetup?.service,
          serviceDetails: othersSetup?.serviceDetails || othersSetup?.service,
          serviceFee: othersSetup ? Number(othersSetup.serviceFee) : Number(othersTotalAmount) || 0,
          totalAmountBDT: totalBDT,
          paidAmountBDT: Number.isFinite(paidBDT) ? paidBDT : 0,
          dueAmountBDT: Number.isFinite(dueBDT) ? dueBDT : 0,
          paymentStatus: paymentStatusBadge.label,
          paymentMethod,
          workingStatus,
          assignEmployee: assignEmployee || undefined,
          note: noteText || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Invoice download failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] || 'AdsBuzz_Others_Invoice.pdf';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setOthersInvoiceError(err?.message || 'Failed to download the invoice. Please try again.');
    } finally {
      setDownloadingOthersInvoice(false);
    }
  };

  const buildInvoiceText = () => {
    const date = new Date().toLocaleDateString('en-GB');
    const invNo = previewInvoiceNo || `ADB ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}000`;
    const custName = activeCustomer?.name || 'Cash Client';
    const paymentLabel = paymentStatusBadge.label;
    return [
      `Date: ${date}`,
      `Invoice No: ${invNo}`,
      `Group ID: ${groupIdCode || ''}`,
      `Platform Name: ${activeAccount?.platform || ''}`,
      ...(serviceType === 'Others' && othersSetup
        ? [`Service: ${othersSetup.service || ''}`, `Service Fee (BDT): ৳${(othersSetup.serviceFee || 0).toLocaleString()}`]
        : [`Ad Account Name: ${activeAccount?.adAccountName || ''}`, `Ad Account ID: ${activeAccount?.adAccountId || ''}`]),
      `USD Dollar Rate: ${dollarRate || 0}`,
      `Amount in USD: ${topupAmountUSD || 0}`,
      `Amount in BDT: ${totalBDT || 0}`,
      `Payment Status: ${paymentLabel}`,
      `TopUp Status: ${topupStatus}`,
      `Paid Amount: ${Number.isFinite(Number(paidBDT)) ? paidBDT : 0}`,
      `Due Amount: ${Number.isFinite(Number(dueBDT)) ? dueBDT : 0}`,
    ].join('\n');
  };

  const handleCopyInvoice = () => {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(buildInvoiceText())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  // Builds the plain-text invoice copy for an existing sales record so the
  // "Copy Invoice" action in the Sales Entry Records table can be used from the
  // table without relying on the checkout state.
  const buildRecordInvoiceText = (inv) => {
    const isOther = inv.serviceType === 'Others' || !!inv.serviceDetails;
    return [
      `Date: ${inv.date || ''}`,
      `Invoice No: ${inv.invoiceNo || ''}`,
      `Group ID: ${inv.groupId || ''}`,
      `Platform Name: ${inv.platform || ''}`,
      ...(isOther
        ? [`Service: ${inv.serviceDetails || inv.adAccountName || ''}`, `Service Fee (BDT): ৳${Number(inv.serviceFee || inv.totalAmountBDT || 0).toLocaleString()}`]
        : [`Ad Account Name: ${inv.adAccountName || ''}`, `Ad Account ID: ${inv.adAccountId || ''}`]),
      `USD Dollar Rate: ${inv.dollarRate || 0}`,
      `Amount in USD: ${inv.topupAmountUSD || 0}`,
      `Amount in BDT: ${inv.totalAmountBDT || 0}`,
      `Payment Status: ${inv.paymentStatus || ''}`,
      `TopUp Status: ${inv.topupStatus || ''}`,
      `Paid Amount: ${Number.isFinite(Number(inv.paidAmountBDT)) ? inv.paidAmountBDT : 0}`,
      `Due Amount: ${Number.isFinite(Number(inv.dueAmountBDT)) ? inv.dueAmountBDT : 0}`,
    ].join('\n');
  };

  const computePaymentLabel = (inv) => {
    const total = Number(inv.totalAmountBDT || 0);
    const paid = Number(inv.paidAmountBDT || 0);
    if (paid <= 0) return 'Due';
    if (paid >= total) return 'Paid';
    return 'Partially Paid';
  };

  const handleCopyRecordInvoice = (inv) => {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(buildRecordInvoiceText(inv))
      .then(() => {
        setCopiedRecord(inv.invoiceNo);
        setTimeout(() => setCopiedRecord(''), 2000);
      })
      .catch(() => {});
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || !onDeleteInvoice) return;
    try {
      await onDeleteInvoice(deleteTarget.invoiceNo);
      salesInvoicePages.refetch();
    } catch (err) {
      // The hook/context already surfaced a toast with the error.
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-fade-in" id="sales-view">
      
      {/* Checkout Steps Indicator + Historical Entry Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div id="checkout-steps-indicator" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-2xl shadow-sm inline-flex">
        <div className="flex items-center justify-start gap-1.5">
          {STEP_HEADERS.map((step) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  className="flex items-center gap-1.5 hover:opacity-85 active:scale-95 transition-all cursor-pointer focus:outline-none text-left"
                >
                  <div className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                    isCompleted
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? 'bg-brand-blue text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {isCompleted ? <Check size={12} /> : step.id}
                  </div>
                  <span className={`text-xs font-semibold whitespace-nowrap ${
                    isActive
                      ? 'text-slate-900 dark:text-white font-bold underline decoration-[#1F5E98] underline-offset-4'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                    {step.name}
                  </span>
                </button>
                {step.id < 3 && <ChevronRight size={14} className="text-slate-300 mx-1 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      <Button
        id="btn-historical-sales"
        variant="outline"
        onClick={openHistModal}
        leftIcon={<CalendarDays size={14} />}
        className="shrink-0"
      >
        Historical / Previous Month Sales Entry
      </Button>
      </div>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left column: Steps forms (span 7) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm shadow-slate-100 dark:shadow-none min-h-[500px] flex flex-col justify-between">
          <form onSubmit={handleCheckoutSubmit} id="checkout-form" className="space-y-6">
            
            {/* Step 1: Select Customer & Ad Account */}
            {currentStep === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white font-sans">Select Customer &amp; Ad Account</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Pick the client, group, platform, and ad account for this transaction.</p>
                </div>

                {/* 1. Service Type */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Service Type</label>
                  <div className="flex gap-4 items-center">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                      <input
                        type="radio"
                        name="serviceTypeRadio"
                        value="Ad Account Topup"
                        checked={serviceType === 'Ad Account Topup'}
                        onChange={() => setServiceType('Ad Account Topup')}
                        className="text-brand-orange focus:ring-brand-orange"
                      />
                      Ad Account Topup
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-400">
                      <input
                        type="radio"
                        name="serviceTypeRadio"
                        value="Others"
                        checked={serviceType === 'Others'}
                        onChange={() => setServiceType('Others')}
                        className="text-brand-orange focus:ring-brand-orange"
                      />
                      Others
                    </label>
                  </div>
                  {!serviceType && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Please select a service type to continue.</p>
                  )}
                </div>

                {/* Sale Entry Date */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
                  <input
                    id="checkout-sale-date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                  />
                </div>

                {/* 2. Group ID Search */}
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Select Group ID</label>
                    {groupIdCode ? (
                      <div className="flex items-center justify-between gap-3 p-3 border border-brand-blue dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl">
                        <span className="text-xs font-bold text-brand-blue dark:text-blue-300 font-mono truncate">{groupIdCode}</span>
                        <button
                          type="button"
                          onClick={handleClearGroup}
                          className="text-[10px] font-bold text-brand-blue dark:text-blue-300 hover:underline cursor-pointer shrink-0"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            id="checkout-group-search"
                            type="text"
                            placeholder="Please select / search a Group ID..."
                            value={groupIdSearch}
                            onChange={(e) => { setGroupIdSearch(e.target.value); setGroupIdCode(''); setSelectedCustomerId(''); }}
                            className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
                          />
                          <Search className="absolute left-3 top-3 text-slate-400" size={14} />
                        </div>
                        {filteredGroupOptions.length > 0 ? (
                          <ul className="mt-1.5 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {filteredGroupOptions.map(id => (
                              <li key={id}>
                                <button
                                  type="button"
                                  onClick={() => handleSelectGroup(id)}
                                  className="w-full text-left px-3 py-2 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                >
                                  {id}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic mt-1.5">No group IDs match your search.</p>
                        )}
                      </>
                    )}
                    {!groupIdCode && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 font-semibold">Please select a Group ID to continue.</p>
                    )}
                    {groupIdCode && (
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {customersInGroup.length} customer{customersInGroup.length === 1 ? '' : 's'} in this group.
                      </p>
                    )}
                  </div>
                </div>

                {/* Select Service — shown for Other Services after an Other Service Group is selected */}
                {serviceType === 'Others' && groupIdCode && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Select Service</label>
                    {othersServiceOptions.length > 0 ? (
                      <select
                        id="checkout-others-service-select"
                        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={selectedOthersServiceId}
                        onChange={(e) => setSelectedOthersServiceId(e.target.value)}
                      >
                        {othersServiceOptions.map((s) => {
                          const key = othersServiceKeyOf(s);
                          const label = s.service
                            ? `${s.service} — ৳${Number(s.serviceFee || 0).toLocaleString()}`
                            : `${s.serviceDetails || 'Service'} — ৳${Number(s.serviceFee || 0).toLocaleString()}`;
                          return (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No active services found for this Group ID. Please configure one on the Sale Setup page.</p>
                    )}
                  </div>
                )}

                {/* 3. Client Information — resolved automatically from the selected Group ID */}
                {serviceType !== 'Others' && <div className="space-y-4">
                  {activeCustomer ? (
                    <div className="p-4 rounded-xl border border-blue-50 dark:border-blue-950/20 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-brand-blue dark:text-blue-400">Customer Information</h4>
                        <span className="text-[10px] font-mono font-bold text-brand-blue/80 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-900/40">
                          {activeCustomer.name} ({activeCustomer.companyName})
                        </span>
                      </div>
                      {topupSummaryLoading ? (
                        <div className="py-3 text-center text-[11px] text-slate-400">
                          <div className="mx-auto mb-2 h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" />
                          Calculating topup history...
                        </div>
                      ) : topupSummary ? (
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Lifetime Topup USD</p>
                            <p className="font-black text-slate-900 dark:text-white mt-0.5">${topupSummary.lifetimeTotalTopupUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Lifetime Topup BDT</p>
                            <p className="font-black text-slate-900 dark:text-white mt-0.5">৳{topupSummary.lifetimeTotalTopupBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Month USD</p>
                            <p className="font-black text-slate-900 dark:text-white mt-0.5">${topupSummary.currentMonthTotalTopupUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Current Month BDT</p>
                            <p className="font-black text-slate-900 dark:text-white mt-0.5">৳{topupSummary.currentMonthTotalTopupBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400">No topup history found for this customer yet.</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/10 text-center">
                      <p className="text-[11px] text-slate-400">
                        Select a Group ID to automatically load the customer information.
                      </p>
                    </div>
                  )}
                </div>}

                {/* 4. Target Ad Account (assigned to this customer only) */}
                {serviceType !== 'Others' && <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Ad Account</label>
                    {customerAccounts.length === 0 ? (
                      <div className="p-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 rounded-xl">
                        {selectedCustomerId
                          ? <>No ad accounts are currently assigned to this client. Go to <span className="font-bold underline cursor-pointer" onClick={onNavigateToCustomers}>Ad Accounts inventory</span> to assign one.</>
                          : 'Please select a Group ID first to see their assigned ad accounts.'}
                      </div>
                    ) : (
                      <select
                        id="checkout-account-select"
                        required
                        className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {customerAccounts.map(acc => (
                          <option key={acc.adAccountId} value={acc.adAccountId}>
                            {acc.adAccountName} (ID: ...{acc.adAccountId.slice(-6)}) - Rate: ৳{getEffectiveRate(acc)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* 5. Account / Topup Information (only topups taken after assignment) */}
                  {activeAccount && (() => {
                    const totalUSD = matchingAccountInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
                    const totalBDTUsed = matchingAccountInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || 0), 0);

                    return (
                      <div className="p-3.5 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2 text-[11px] bg-transparent dark:bg-transparent">
                        <div className="flex justify-between items-center pb-1.5 border-b border-sky-200/80 dark:border-sky-800/80">
                          <span className="text-sky-800 dark:text-sky-300 font-medium">BM Hub:</span>
                          <span className="font-bold text-sky-950 dark:text-sky-100">{activeAccount.bmName || "AdsBuzz Partner"}</span>
                        </div>
                        <div className="flex justify-between items-center pb-1.5 border-b border-sky-200/80 dark:border-sky-800/80">
                          <span className="text-sky-800 dark:text-sky-300 font-medium">Assigned Card:</span>
                          <span className="font-mono font-bold text-sky-950 dark:text-sky-100">{activeAccount.billingCard || "None Linked"}</span>
                        </div>
                        <div className="flex justify-between items-center pb-1.5 border-b border-sky-200/80 dark:border-sky-800/80">
                          <span className="text-sky-800 dark:text-sky-300 font-medium">Platform:</span>
                          <span className="font-bold text-sky-950 dark:text-sky-100">{platform || '—'}</span>
                        </div>
                        {activeAccountSetup && (
                          <div className="flex justify-between items-center pb-1.5 border-b border-sky-200/80 dark:border-sky-800/80">
                            <span className="text-sky-800 dark:text-sky-300 font-medium">Sales Setup:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">Rate ৳{activeAccountSetup.dollarRate}{Number(activeAccountSetup.monthlySpending) > 0 ? ` · Spend $${activeAccountSetup.monthlySpending}` : ''}</span>
                          </div>
                        )}

                        <div className="pt-1.5 border-t border-sky-200/80 dark:border-sky-800/80 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sky-900 dark:text-sky-200">Topups Since Assignment:</span>
                            <span className="text-[10px]  text-sky-900 dark:text-sky-100 px-2 py-0.5 rounded font-bold">
                              {matchingAccountInvoices.length} {matchingAccountInvoices.length === 1 ? 'top-up' : 'top-ups'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-transparent dark:bg-transparent p-2.5 rounded-lg border border-sky-200 dark:border-sky-700/60 shadow-xs">
                              <p className="text-[9px] text-sky-800 dark:text-sky-300 font-bold uppercase tracking-wider">Total USD Top-up</p>
                              <p className="text-xs font-black text-sky-950 dark:text-white mt-0.5">${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-transparent dark:bg-transparent p-2.5 rounded-lg border border-sky-200 dark:border-sky-700/60 shadow-xs">
                              <p className="text-[9px] text-sky-800 dark:text-sky-300 font-bold uppercase tracking-wider">Total BDT Spent</p>
                              <p className="text-xs font-black text-sky-950 dark:text-white mt-0.5">৳{totalBDTUsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                        </div>
                    </div>
                  );
                })()}

                {/* Others Sale Setup Info */}
                 {serviceType === 'Others' && othersSetup && (
                   <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 text-[11px] bg-amber-50/40 dark:bg-amber-950/10">
                     <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/80 dark:border-amber-800/80">
                       <span className="text-amber-800 dark:text-amber-300 font-medium">Service</span>
                       <span className="font-bold text-amber-950 dark:text-amber-100">{othersSetup.service}</span>
                     </div>
                     <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/80 dark:border-amber-800/80">
                       <span className="text-amber-800 dark:text-amber-300 font-medium">Service Details</span>
                       <span className="font-bold text-amber-950 dark:text-amber-100">{othersSetup.serviceDetails || '—'}</span>
                     </div>
                     <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/80 dark:border-amber-800/80">
                       <span className="text-amber-800 dark:text-amber-300 font-medium">Service Fee (BDT ৳)</span>
                       <span className="font-bold text-amber-700 dark:text-amber-300">৳{(othersSetup.serviceFee || 0).toLocaleString()}</span>
                     </div>
                   </div>
                 )}

                 {/* Others Sale Setup Info (when group selected but no active setup yet) */}
                 {serviceType === 'Others' && !othersSetup && groupIdCode && (
                   <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 space-y-2 text-[11px] bg-amber-50/40 dark:bg-amber-950/10">
                     <div className="flex justify-between items-center pb-1.5 border-b border-amber-200/80 dark:border-amber-800/80">
                       <span className="text-amber-800 dark:text-amber-300 font-medium">Service Fee</span>
                       <span className="font-bold text-amber-700 dark:text-amber-300">৳0.00</span>
                     </div>
                     <p className="text-[10px] text-amber-600 dark:text-amber-400">No active Others Sale Setup found for this Group ID. Please configure one on the Sale Setup page.</p>
                   </div>
                 )}

                 </div>}

                 </motion.div>
             )}

            {/* Step 2: Configure Payment */}
            {currentStep === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Configure Payment</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Enter the amount the customer paid, then confirm the dollar rate, payment method, status, screenshot, and auditor notes.</p>
                </div>

                <div className="space-y-4">

                  {/* Payment fields vary by service type; account topups retain their existing fields. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{serviceType === 'Others' ? 'TOTAL AMOUNT (BDT)' : 'TOPUP AMOUNT (USD)'}</label>
                      <div className="relative">
                        <input
                          id={serviceType === 'Others' ? 'checkout-total-amount' : 'checkout-amount-usd'}
                          type="number"
                          required
                          min={1}
                          className="w-full text-xs pl-8 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                          value={serviceType === 'Others' ? (othersTotalAmount || '') : (topupAmountUSD || '')}
                          onChange={(e) => serviceType === 'Others'
                            ? setOthersTotalAmount(Number(e.target.value))
                            : setTopupAmountUSD(Number(e.target.value))}
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">{serviceType === 'Others' ? '৳' : '$'}</span>
                      </div>
                    </div>
                    {serviceType !== 'Others' && <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Dollar Rate (BDT/USD)</label>
                      <input
                        id="checkout-dollar-rate"
                        type="number"
                        required
                        disabled
                        readOnly
                        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl focus:outline-none font-bold cursor-not-allowed"
                        value={dollarRate}
                      />
                    </div>}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">AMOUNT TO PAY (BDT)</label>
                      <div className="relative">
                        <input
                          id="checkout-total-bdt"
                          type="text"
                          readOnly
                          disabled
                          className="w-full text-xs pl-8 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl focus:outline-none font-bold cursor-not-allowed"
                          value={`৳${totalBDT.toLocaleString()}`}
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">৳</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 block">{serviceType === 'Others' ? 'Total amount for this service' : 'Auto-calculated: USD x Dollar Rate'}</span>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Payment Channel</label>
                      <select
                        id="checkout-payment-method"
                        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        {paymentMethods.map(pm => (
                          <option key={pm} value={pm}>{pm}</option>
                        ))}
                      </select>
                    </div>

                    {/* Paid Amount (BDT) — editable, drives payment status (Paid / Partial / Due) */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        PAID AMOUNT (BDT)
                        <span className="ml-2 normal-case font-semibold text-[10px] text-slate-400">
                          Drives:&nbsp;
                          <span className={paymentStatusBadge.color}>{paymentStatusBadge.label}</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="checkout-paid-bdt"
                          type="number"
                          required
                          min={0}
                          step="0.01"
                          className="w-full text-xs pl-8 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                          value={paidBDT === '' || paidBDT === null || paidBDT === undefined ? '' : paidBDT}
                          onChange={(e) => setPaidBDT(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">৳</span>
                      </div>
                      {/* Outstanding Due — prominent box */}
                      <div className={`mt-2 p-2.5 rounded-xl border text-center ${
                        Number.isFinite(dueBDT) && dueBDT > 0
                          ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                      }`}>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Outstanding Due</p>
                        <p className={`text-sm font-black mt-0.5 ${Number.isFinite(dueBDT) && dueBDT > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          ৳{Number.isFinite(dueBDT) ? dueBDT.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0.00'}
                        </p>
                      </div>
                    </div>

                    {/* Working Status / Topup Status */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">{serviceType === 'Others' ? 'Working Status' : 'Topup Status'}</label>
                      {serviceType === 'Others' ? (
                        <select
                          id="checkout-working-status"
                          className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                          value={workingStatus}
                          onChange={(e) => setWorkingStatus(e.target.value)}
                        >
                          <option value="Assigned">Assigned</option>
                          <option value="In Progress">In Progress</option>
                        </select>
                      ) : (
                        <select
                          id="checkout-topup-status"
                          className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                          value={topupStatus}
                          onChange={(e) => setTopupStatus(e.target.value)}
                        >
                            <option value="Successfull">Successful</option>
                            <option value="NotYet">NOT YET</option>
                            <option value="Due">Due</option>
                        </select>
                      )}
                    </div>
                    {serviceType === 'Others' && <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Assign Employee (Not Required)</label>
                      <input
                        id="checkout-assign-employee"
                        type="text"
                        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={assignEmployee}
                        onChange={(e) => setAssignEmployee(e.target.value)}
                      />
                    </div>}
                  </div>

                  {/* Payment Screenshots — up to 3 (at least 1 required) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Payment Screenshots <span className="text-rose-500">*</span>
                      <span className="ml-2 normal-case font-semibold text-[10px] text-slate-400">(at least 1 required, up to 3)</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[0, 1, 2].map((slot) => {
                        const shot = paymentScreenshots.find((s) => s.slot === slot);
                        const isRequired = slot === 0;
                        return (
                          <div key={slot}>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1.5 uppercase tracking-wide">
                              Screenshot {slot + 1} {isRequired ? '' : <span className="normal-case font-semibold text-slate-400">(optional)</span>}
                            </p>
                            {shot ? (
                              <div className="relative w-full border border-emerald-200 dark:border-emerald-800/60 rounded-xl overflow-hidden bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white">
                                    <img
                                      src={shot.data}
                                      alt={`Payment Screenshot ${slot + 1}`}
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                      <CheckCircle size={12} /> Attached
                                    </p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={shot.name}>
                                      {shot.name}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleRemoveScreenshot(slot)}
                                      className="mt-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                    >
                                      <XIcon size={10} /> Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <label
                                htmlFor={`checkout-payment-screenshot-${slot}`}
                                className="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-blue hover:bg-blue-50/40 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer transition-colors text-center"
                              >
                                <Upload size={18} className="text-slate-400" />
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                  Upload
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  PNG, JPG, GIF (max 5 MB)
                                </span>
                                <input
                                  id={`checkout-payment-screenshot-${slot}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleScreenshotUpload(slot)}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {screenshotError && (
                      <p className="text-[10px] text-rose-500 font-semibold mt-1.5 flex items-center gap-1">
                        <XIcon size={10} /> {screenshotError}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Author Note {!hasPaidAmount && <span className="text-rose-500">*</span>}
                      {!hasPaidAmount && (
                        <span className="ml-2 normal-case font-semibold text-[10px] text-amber-600 dark:text-amber-400">
                          Required when no amount is paid
                        </span>
                      )}
                    </label>
                    <input
                      id="checkout-note"
                      type="text"
                      placeholder={hasPaidAmount ? "e.g. Approved via EBL App transfer ref #90123" : "e.g. Customer will settle the outstanding amount on receipt of invoice"}
                      className={`w-full text-xs p-2.5 border rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 ${
                        !hasPaidAmount
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-950/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                    />
                    {!hasPaidAmount && !noteText?.trim() && (
                      <p className="text-[10px] text-rose-500 font-semibold mt-1.5">An Author Note is required when no amount is paid.</p>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

            {/* Step 3: Payment Summary Review */}
            {currentStep === 3 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-950 dark:text-white">Payment Summary &amp; Review</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Please review the transaction summary below before executing the top-up.</p>
                </div>

                <div className="space-y-4 border border-border-blue dark:border-border-blue rounded-2xl p-6 bg-surface-blue dark:bg-surface-blue text-brand-blue-deep dark:text-brand-blue-deep shadow-sm">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Customer</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{activeCustomer?.name || 'N/A'}</p>
                      <p className="text-xs text-brand-blue-deep/70 dark:text-brand-blue-deep/70 font-medium mt-0.5">{activeCustomer?.companyName}</p>
                      <p className="text-[10px] font-mono font-bold text-brand-blue-deep/70 dark:text-brand-blue-deep/70 mt-1 inline-flex items-center gap-1.5">
                        <span>Group ID:</span>
                        <span className="px-1.5 py-0.5 rounded border border-border-blue dark:border-border-blue bg-surface dark:bg-surface">{groupIdCode || '—'}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Publisher Platform</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep flex items-center gap-2 mt-0.5">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          platform === 'Facebook' ? 'bg-[#1877F2]' :
                          platform === 'TikTok' ? 'bg-[#FE2C55]' :
                          platform === 'Google' ? 'bg-[#22C55E]' : 'bg-[#FACC15]'
                        }`} />
                        <PlatformText platform={platform} />
                      </p>
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-border-blue dark:border-border-blue">
                     <div>
                       <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">
                         {serviceType === 'Others' ? 'Service' : 'Target Ad Account'}
                       </p>
                       <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">
                         {serviceType === 'Others' ? (othersSetup?.service || 'N/A') : (activeAccount?.adAccountName || 'N/A')}
                       </p>
                       <p className="text-xs font-mono font-medium text-brand-blue-deep/70 dark:text-brand-blue-deep/70 mt-0.5">
                         {serviceType === 'Others'
                           ? (othersSetup?.serviceDetails ? `Fee: ৳${(othersSetup.serviceFee || 0).toLocaleString()}` : '')
                           : `ID: ${activeAccount?.adAccountId}`}
                       </p>
                     </div>
                     {serviceType !== 'Others' && <div>
                       <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Billing BM Hub</p>
                       <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{activeAccount?.bmName || 'AdsBuzz Partner'}</p>
                     </div>}
                   </div>

                  <div className={`grid ${serviceType === 'Others' ? 'grid-cols-2' : 'grid-cols-3'} gap-3 text-xs pt-4 border-t border-border-blue dark:border-border-blue text-center`}>
                    {serviceType === 'Others' ? (
                      <div className="bg-surface-orange dark:bg-surface-orange p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
                        <p className="text-[10px] text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wider font-extrabold">TOTAL AMOUNT</p>
                        <p className="text-base sm:text-lg font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">৳{totalBDT.toLocaleString()}</p>
                      </div>
                    ) : (
                      <>
                        <div className="bg-surface-orange dark:bg-surface-orange p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
                          <p className="text-[10px] text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wider font-extrabold">USD TOP-UP</p>
                          <p className="text-base sm:text-lg font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${topupAmountUSD}</p>
                        </div>
                        <div className="bg-surface-green dark:bg-surface-green p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
                          <p className="text-[10px] text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wider font-extrabold">DOLLAR RATE</p>
                          <p className="text-base sm:text-lg font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">৳{dollarRate}</p>
                        </div>
                        <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue-light dark:border-border-blue-light shadow-xs">
                          <p className="text-[10px] text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wider font-extrabold">TOTAL BDT</p>
                          <p className="text-base sm:text-lg font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">৳{totalBDT.toLocaleString()}</p>
                        </div>
                      </>
                    )}
                  </div>

                   {serviceType === 'Others' && othersSetup && (
                     <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-amber-200/40 dark:border-amber-800/40">
                       <div>
                         <p className="text-amber-700 dark:text-amber-300 font-semibold">Service</p>
                         <p className="font-extrabold text-sm text-amber-950 dark:text-amber-100 mt-0.5">{othersSetup.service}</p>
                       </div>
                     </div>
                   )}

                   <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-border-blue dark:border-border-blue">
                     <div>
                       <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">BDT Amount Paid</p>
                       <p className="font-black text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">৳{Number(paidBDT || 0).toLocaleString()}</p>
                     </div>
                     <div>
                       <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Remaining Due</p>
                       <p className={`font-black text-sm mt-0.5 ${dueBDT > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                         ৳{dueBDT.toLocaleString()}
                       </p>
                     </div>
                   </div>

                  <div className={`grid ${serviceType === 'Others' ? 'grid-cols-2' : 'grid-cols-3'} gap-4 text-xs pt-4 border-t border-border-blue dark:border-border-blue items-center`}>
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Payment Channel</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{paymentMethod}</p>
                    </div>
                    {serviceType === 'Others' ? <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold mb-1">Working Status</p>
                      <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-lg font-extrabold border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800">{workingStatus}</span>
                    </div> : <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold mb-1">Topup Status</p>
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-lg font-extrabold border ${
                        topupStatus === 'Successfull'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' :
                        topupStatus === 'Pending'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                      }`}>
                        {topupStatus === 'Successfull' ? 'Successful' : topupStatus}
                      </span>
                    </div>}
                    {serviceType === 'Others' && <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold mb-1">Assign Employee</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep">{assignEmployee || 'Not assigned'}</p>
                    </div>}
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold mb-1">Payment Status</p>
                      <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-lg font-extrabold border ${
                        paymentStatusBadge.label === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                          : paymentStatusBadge.label === 'Partially Paid'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                      }`}>
                        {paymentStatusBadge.label}
                      </span>
                    </div>
                  </div>

                  {paymentScreenshots.length > 0 && (
                    <div className="pt-4 border-t border-border-blue dark:border-border-blue">
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold text-xs mb-2">
                        Payment Screenshots ({paymentScreenshots.length})
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {paymentScreenshots.map((shot, idx) => (
                          <div key={shot.slot} className="bg-surface dark:bg-surface p-2.5 rounded-xl border border-border-blue-light dark:border-border-blue-light inline-flex items-center gap-3 shadow-xs">
                            <div className="h-16 w-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                              <img
                                src={shot.data}
                                alt={`Payment Screenshot ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="text-xs">
                              <p className="font-extrabold text-brand-blue-deep dark:text-brand-blue-deep">{shot.name || 'Attached'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">Proof of payment on file</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {noteText && (
                    <div className="pt-4 border-t border-border-blue dark:border-border-blue text-xs">
                      <p className="text-slate-400 font-medium">Auditor Notes</p>
                      <p className="text-brand-blue-deep dark:text-brand-blue-deep mt-0.5 italic bg-surface dark:bg-surface p-2.5 rounded-lg border border-border-blue-light dark:border-border-blue-light">&ldquo;{noteText}&rdquo;</p>
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-amber-500/10 text-amber-600 rounded-xl text-[11px] border border-amber-500/20 flex items-start gap-2">
                  <Shield size={14} className="flex-shrink-0 mt-0.5" />
                  <span>By clicking &ldquo;Save &amp; Execute Topup&rdquo;, this transaction will be finalized, credit balances will be updated immediately, and an ledger invoice will be generated.</span>
                </div>
              </motion.div>
            )}

            {/* Global validation error */}
            {validationError && (
              <div className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/50 p-3.5 rounded-xl mb-4 animate-fade-in">
                {validationError}
              </div>
            )}

            {/* Steps Nav Button Box */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center mt-8">
              {currentStep > 1 ? (
                <button
                  type="button"
                  id="checkout-back"
                  onClick={handlePrevStep}
                  className="text-xs font-bold text-white bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                >
                  Go Back
                </button>
              ) : (
                <div />
              )}

              {currentStep < 3 ? (
                <button
                  type="button"
                  id="checkout-next"
                  onClick={handleNextStep}
                  className="flex items-center gap-2 bg-brand-blue hover:bg-[#154673] active:scale-95 transition-all text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
                >
                  Continue <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="submit"
                  id="checkout-submit"
                  disabled={!canSubmit}
                  className={`flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer ${!canSubmit ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  Make Sale
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Right column: Order Summary Receipt (span 5) */}
        <div id="checkout-invoice-card" className="lg:col-span-5 bg-surface dark:bg-surface p-6 rounded-2xl border border-border-blue-light dark:border-border-blue-light sticky top-6 shadow-sm">
          {/* Copy button above the live invoice */}
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-border-blue-light dark:border-border-blue-light mb-6">
            <div className="flex items-center gap-2">
              <Receipt className="text-brand-blue-dark dark:text-brand-blue-dark" size={16} />
              <h3 className="text-xs font-bold text-brand-blue-deep dark:text-brand-blue-deep uppercase tracking-wider">Live Checkout Invoice</h3>
            </div>
            <div className="flex items-center gap-2">
              {serviceType === 'Others' && (
                <button
                  id="btn-download-others-invoice"
                  type="button"
                  onClick={handleDownloadOthersInvoice}
                  disabled={downloadingOthersInvoice}
                  className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 ${
                    downloadingOthersInvoice
                      ? 'bg-slate-300 text-slate-600 cursor-wait'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  <Download size={12} />
                  {downloadingOthersInvoice ? 'Preparing…' : 'Download Invoice'}
                </button>
              )}
              <button
                id="btn-copy-invoice"
                type="button"
                onClick={handleCopyInvoice}
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-brand-blue text-white hover:bg-[#154673]'
                }`}
              >
                {copied ? <CopyCheck size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          {serviceType === 'Others' && othersInvoiceError && (
            <p className="text-[10px] text-rose-500 font-semibold mb-4">{othersInvoiceError}</p>
          )}

          {/* Client summary */}
          <div className="space-y-4">
            <div className="flex justify-between items-start text-xs">
              <div>
                <p className="text-slate-400 font-medium">Billed To:</p>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1">{activeCustomer?.name || "No Client Selected"}</p>
                <p className="text-[10px] text-slate-400">{activeCustomer?.companyName}</p>
              </div>
              {activeCustomer && (
                <span className="text-[10px] bg-surface-blue dark:bg-surface-blue text-brand-blue-deep dark:text-brand-blue-deep font-mono px-2 py-0.5 rounded border border-border-blue dark:border-border-blue">
                  {activeCustomer.id}
                </span>
              )}
            </div>

            {/* Ad account summary */}
            <div className="pt-4 border-t border-dashed border-border-blue-light dark:border-border-blue-light">
              <p className="text-xs text-slate-400 font-medium">Publisher Ad Account:</p>
              {activeAccount ? (
                <div className="mt-2 p-3 rounded-xl bg-surface-blue-light dark:bg-surface-blue-light border border-border-blue-light dark:border-border-blue-light">
                  <div className="flex justify-between items-center text-xs font-bold text-brand-blue-deep dark:text-brand-blue-deep">
                    <span className="truncate max-w-[200px]">{activeAccount.adAccountName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      platform === 'Facebook' ? 'bg-blue-50 dark:bg-blue-900/20' :
                      platform === 'TikTok' ? 'bg-pink-50 dark:bg-pink-900/20' :
                      platform === 'Google' ? 'bg-sky-50 dark:bg-sky-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'
                    }`}>
                      <PlatformText platform={platform} />
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {activeAccount.adAccountId}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic mt-1">Please select an ad account in Step 1</p>
              )}
            </div>

            {/* Calculated Pricing Ledger (Shopify checkout total) */}
            <div className="pt-6 border-t border-border-blue-light dark:border-border-blue-light space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Topup Value (USD)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">${Number(topupAmountUSD || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Account Dollar Rate (BDT)</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">৳{dollarRate} / $</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500">
                <span>Payment Gate Fee</span>
                <span className="text-slate-400">৳0.00</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-brand-blue-deep dark:text-brand-blue-deep pt-2 border-t border-border-blue-light dark:border-border-blue-light">
                <span>Total Calculated BDT</span>
                <span>৳{totalBDT.toLocaleString()}</span>
              </div>
            </div>

            {/* BDT Paid & Remaining Due tracking */}
            <div className="pt-4 border-t border-dashed border-border-blue-light dark:border-border-blue-light space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Paid Amount BDT</span>
                <span className="font-semibold text-emerald-600">৳{Number(paidBDT || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold pt-1">
                <span>Remaining Account Due</span>
                <span className={dueBDT > 0 ? 'text-red-500' : 'text-emerald-500'}>
                  {dueBDT > 0 ? `৳${dueBDT.toLocaleString()}` : '৳0.00 (Settled)'}
                </span>
              </div>
            </div>

            {/* Payment security info */}
            <div className="pt-6 border-t border-border-blue-light dark:border-border-blue-light flex items-center gap-2 text-[10px] text-slate-400">
              <Shield size={14} className="text-emerald-500 flex-shrink-0" />
              <span>ERP transaction logged immediately. All BDT to BDT conversions verified against Eastern Bank Ltd (EBL) exchange rates.</span>
            </div>
          </div>
        </div>

      </div>

      {/* Ad Account Sales Search — verify recorded sales entries by date */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mt-8">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Search Sales by Ad Account</h3>
            <p className="text-xs text-slate-500">Find every date a sales entry was recorded for an Ad Account ID or Name. Use it to verify entries are correct and none are missing.</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAdAccountSearch();
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                id="ad-account-search-input"
                type="text"
                value={adAccountSearch}
                onChange={(e) => setAdAccountSearch(e.target.value)}
                placeholder="Enter Ad Account ID (e.g. 206893199112660) or Ad Account Name..."
                className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
              />
            </div>
            <Button type="submit" id="ad-account-search-btn" leftIcon={<Search size={14} />} disabled={adAccountSearchLoading}>
              {adAccountSearchLoading ? 'Searching…' : 'Search'}
            </Button>
            {(adAccountSearchResults || adAccountSearchRan) && (
              <Button type="button" variant="ghost" onClick={clearAdAccountSearch}>
                Clear
              </Button>
            )}
          </form>

          {adAccountSearchError && (
            <div className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/50 p-3 rounded-xl">
              {adAccountSearchError}
            </div>
          )}

          {adAccountSearchLoading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-6">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs font-semibold">Searching sales entries…</span>
            </div>
          )}

          {!adAccountSearchLoading && adAccountSearchRan && adAccountSearchResults && (
            <div className="space-y-4">
              {/* Summary header */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1.5 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-brand-blue text-white text-[10px] font-black">
                    {adAccountSearchResults.total}
                  </span>
                  Matching Entries
                </span>
                <span className="text-xs px-3 py-1.5 rounded-full font-bold inline-flex items-center gap-1.5 shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                  <CalendarDays size={13} className="text-brand-blue" />
                  {adAccountSearchResults.dates.length} {adAccountSearchResults.dates.length === 1 ? 'Date' : 'Dates'} with Entries
                </span>
                {(adAccountSearchResults.entries[0]?.adAccountName || adAccountSearchResults.entries[0]?.adAccountId) && (
                  <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 truncate max-w-full">
                    {adAccountSearchResults.entries[0].adAccountName}
                    {adAccountSearchResults.entries[0].adAccountId ? ` (ID: ${adAccountSearchResults.entries[0].adAccountId})` : ''}
                  </span>
                )}
              </div>

              {adAccountSearchResults.total === 0 ? (
                <div className="text-center py-8">
                  <XCircle className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
                  <p className="text-xs text-slate-500">No sales entries found for &ldquo;{adAccountSearchResults.query}&rdquo;.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Check the Ad Account ID or Name and try again. This helps confirm whether entries are missing.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950/20 font-bold border-b border-slate-100 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-3 pl-4 text-left">Sales Date</th>
                        <th className="py-3 text-right">Entries</th>
                        <th className="py-3 text-right">Total USD</th>
                        <th className="py-3 text-right">Total BDT</th>
                        <th className="py-3 pr-4 text-left">Invoice No(s)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {adAccountSearchResults.dates.map((d) => (
                        <tr key={d.date} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 pl-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{d.date}</td>
                          <td className="py-3 text-right font-bold text-slate-900 dark:text-white">{d.count}</td>
                          <td className="py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">${d.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">৳{d.totalBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-3 pr-4 font-mono text-[10px] text-slate-500 dark:text-slate-400 max-w-[220px] truncate" title={d.invoiceNos.join(', ')}>
                            {d.invoiceNos.join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sales Entry Records Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mt-8">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sales Entry Records</h3>
            <p className="text-xs text-slate-500">History of client topup sales entries and settlements.</p>
          </div>
          <span
            id="sales-records-total-badge"
            className="text-xs px-3 py-1.5 rounded-full font-black inline-flex items-center gap-1.5 shadow-sm"
            style={{ backgroundColor: '#F68B2D', color: '#ffffff' }}
          >
            <span style={{ backgroundColor: '#ffffff', color: '#F68B2D' }} className="inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-black">
              {salesInvoicePages.total}
            </span>
            Total Entries
          </span>
        </div>

        {/* Sales Entry Records — Filters (date-wise / month-wise) */}
        <div className="px-4 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            {/* Date-wise filter */}
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <CalendarDays size={12} className="text-slate-400" /> Date-wise Filter
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">From date</label>
                  <input
                    id="sales-filter-date-from"
                    type="date"
                    value={salesDateFrom}
                    onChange={(e) => handleSalesDateFromChange(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
                  />
                </div>
                <span className="hidden sm:block text-xs text-slate-400 font-bold pt-6">—</span>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-slate-400 mb-1">To date</label>
                  <input
                    id="sales-filter-date-to"
                    type="date"
                    value={salesDateTo}
                    onChange={(e) => handleSalesDateToChange(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Select a single date (fill From only) or a date range (From + To).</p>
            </div>

            {/* Month-wise filter */}
            <div className="w-full sm:w-56 shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <CalendarDays size={12} className="text-slate-400" /> Month-wise Filter
              </label>
              <input
                id="sales-filter-month"
                type="month"
                value={salesMonth}
                onChange={(e) => handleSalesMonthChange(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
              />
              <p className="text-[10px] text-slate-400 mt-1">Select a specific month.</p>
            </div>

            {/* Invoice No search */}
            <div className="w-full sm:w-56 shrink-0">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Search size={12} className="text-slate-400" /> Invoice No Search
              </label>
              <div className="relative">
                <input
                  id="sales-filter-invoice-no"
                  type="text"
                  value={salesInvoiceNoSearch}
                  onChange={(e) => handleSalesInvoiceNoSearch(e.target.value)}
                  placeholder="Search by invoice no…"
                  className="w-full text-xs pl-8 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
                />
                {salesInvoiceNoSearch && (
                  <button
                    type="button"
                    onClick={() => handleSalesInvoiceNoSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <XIcon size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Clear */}
            {salesRecordsHasActiveFilter && (
              <button
                id="sales-filter-clear"
                type="button"
                onClick={clearSalesEntryFilters}
                className="shrink-0 text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 self-start lg:self-end"
              >
                <XIcon size={12} /> Clear Filters
              </button>
            )}
          </div>
          {salesRecordsHasActiveFilter && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-3">
              {salesMonth
                ? <>Filtering by month: <span className="font-bold text-slate-700 dark:text-slate-200">{salesMonth}</span></>
                : salesDateFrom && salesDateTo
                  ? salesDateFrom === salesDateTo
                    ? <>Filtering by date: <span className="font-bold text-slate-700 dark:text-slate-200">{salesDateFrom}</span></>
                    : <>Filtering by date range: <span className="font-bold text-slate-700 dark:text-slate-200">{salesDateFrom < salesDateTo ? salesDateFrom : salesDateTo} → {salesDateFrom < salesDateTo ? salesDateTo : salesDateFrom}</span></>
                  : salesDateFrom
                    ? <>Filtering by date: <span className="font-bold text-slate-700 dark:text-slate-200">{salesDateFrom}</span></>
                    : salesDateTo
                      ? <>Filtering by date: <span className="font-bold text-slate-700 dark:text-slate-200">{salesDateTo}</span></>
                      : null}
              {salesInvoiceNoSearch && (
                <>
                  {salesMonth || salesDateFrom || salesDateTo ? ' · ' : ''}
                  Searching Invoice No: <span className="font-bold text-slate-700 dark:text-slate-200">{salesInvoiceNoSearch}</span>
                </>
              )}
              {' · '}Showing {salesInvoicePages.total} {salesInvoicePages.total === 1 ? 'entry' : 'entries'}.
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/20 font-bold border-b border-slate-100 dark:border-slate-800 text-slate-500">
              <tr>
                <th scope="col" className="py-3.5 pl-4">Date</th>
                <th scope="col" className="py-3.5">Invoice No</th>
                <th scope="col" className="py-3.5">Group ID</th>
                <th scope="col" className="py-3.5">Ad Account Name</th>
                <th scope="col" className="py-3.5 text-right">Topup USD</th>
                <th scope="col" className="py-3.5 text-right">Topup BDT</th>
                <th scope="col" className="py-3.5 text-center">Payment Status</th>
                <th scope="col" className="py-3.5 text-center">Approval Status</th>
                <th scope="col" className="py-3.5 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedInvoices.map((inv) => {
                const displayGroupCode = inv.groupId || inv.invoiceNo;
                const paymentStatus = inv.paymentStatus || computePaymentLabel(inv);
                const approvalStatus = inv.approvalStatus || 'Pending';
                const logEntries = auditLogOf(inv);
                return (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-4 font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{inv.date || '—'}</td>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200 font-mono whitespace-nowrap">{inv.invoiceNo}</td>
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200 font-mono">{displayGroupCode}</td>
                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[160px]">{inv.adAccountName}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">${inv.topupAmountUSD}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">৳{(inv.totalAmountBDT ?? 0).toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block whitespace-nowrap ${
                        paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        paymentStatus === 'Partially Paid' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block whitespace-nowrap ${
                        approvalStatus === 'Approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        approvalStatus === 'Pending' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        ['Waiting For Feedback', 'Final Approval Review'].includes(approvalStatus) ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {approvalStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingInvoice({ ...inv });
                            setEditForm({ ...inv });
                            setShowEditInvoiceModal(true);
                          }}
                          leftIcon={<FileEdit size={11} />}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleCopyRecordInvoice(inv)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer transition-colors ${
                            copiedRecord === inv.invoiceNo
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {copiedRecord === inv.invoiceNo ? <CopyCheck size={11} /> : <Copy size={11} />}
                          {copiedRecord === inv.invoiceNo ? 'Copied' : 'Copy Invoice'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogTarget(inv)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-800/60 cursor-pointer transition-colors"
                        >
                          <History size={11} /> View Log {logEntries.length > 0 && `(${logEntries.length})`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(inv)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 border border-rose-100 dark:border-rose-800/60 cursor-pointer transition-colors"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {salesLoading && (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-xs font-semibold">Loading sales entries…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!salesLoading && paginatedInvoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-10">
                    <div className="flex flex-col items-center gap-1.5 text-slate-400">
                      <CalendarDays size={18} className="text-slate-300 dark:text-slate-600" />
                      <span className="text-xs font-semibold">
                        {salesRecordsHasActiveFilter ? 'No sales entries found for the selected filter.' : 'No sales entries found.'}
                      </span>
                      {salesRecordsHasActiveFilter && (
                        <span className="text-[10px]">Try adjusting the date or month filter, or clear filters to see all entries.</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing {paginatedInvoices.length} of {salesInvoicePages.total} entries
          </p>
          <div className="flex items-center gap-2">
            <Button
              id="btn-sales-entry-report"
              variant={showReport ? 'secondary' : 'outline'}
              size="sm"
              onClick={toggleReport}
              leftIcon={<BarChart3 size={13} />}
              className="shrink-0"
            >
              {showReport ? 'Hide Sales Entry Report' : 'Sales Entry Report'}
            </Button>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => salesInvoicePages.setPage(Math.max(1, clampedPage - 1))}
                  disabled={clampedPage === 1}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronRight size={12} className="rotate-180" />
                  Prev
                </button>

                {pageWindow.map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-400">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => salesInvoicePages.setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        p === clampedPage
                          ? 'bg-brand-blue text-white shadow-xs'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  type="button"
                  onClick={() => salesInvoicePages.setPage(Math.min(totalPages, clampedPage + 1))}
                  disabled={clampedPage === totalPages}
                  className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                  <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sales Entry Report — rendered inline below the Sales Entry Records table */}
      {showReport && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mt-4">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="text-brand-blue" size={16} />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sales Entry Report</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Aggregated from the actual Sales Entry data. Each row shows the entry count and total sales amount for that day or month.</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {REPORT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setReportType(tab.id)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                    reportType === tab.id
                      ? 'bg-brand-blue text-white border-brand-blue'
                      : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {reportLoading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 py-10">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-semibold">Loading sales entry report…</span>
              </div>
            )}

            {reportError && (
              <div className="text-xs font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/50 p-3 rounded-xl">
                {reportError}
              </div>
            )}

            {!reportLoading && !reportError && reportData && (() => {
              const activeTab = REPORT_TABS.find((t) => t.id === reportType);
              const rows = activeTab.groupBy === 'day' ? reportData.dayWise : reportData.monthWise;
              const periodLabel = activeTab.groupBy === 'day' ? 'Date' : 'Month';
              const totalCount = rows.reduce((s, r) => s + r.count, 0);
              const totalUSD = rows.reduce((s, r) => s + r.totalUSD, 0);
              const totalBDT = rows.reduce((s, r) => s + r.totalBDT, 0);
              return (
                <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-950/20 font-bold border-b border-slate-100 dark:border-slate-800 text-slate-500">
                      <tr>
                        <th className="py-3 pl-4 text-left">{periodLabel}</th>
                        <th className="py-3 text-right">Entry Count</th>
                        <th className="py-3 text-right">Total USD</th>
                        <th className="py-3 pr-4 text-right">Total BDT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rows.map((r) => (
                        <tr key={r.date || r.month} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 pl-4 font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.date || r.month}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white">{r.count}</td>
                          <td className="py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">${r.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2.5 pr-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">৳{r.totalBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-xs text-slate-400">No sales entries found.</td>
                        </tr>
                      )}
                    </tbody>
                    {rows.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-950/30 font-bold">
                          <td className="py-2.5 pl-4 text-slate-700 dark:text-slate-200">Total</td>
                          <td className="py-2.5 text-right text-slate-900 dark:text-white">{totalCount}</td>
                          <td className="py-2.5 text-right text-slate-900 dark:text-white whitespace-nowrap">${totalUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td className="py-2.5 pr-4 text-right text-slate-900 dark:text-white whitespace-nowrap">৳{totalBDT.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* View Log modal */}
      <Modal
        isOpen={!!logTarget}
        onClose={() => setLogTarget(null)}
        title={`Activity Log — ${logTarget?.invoiceNo ?? ''}`}
        description="Complete workflow history for this sales entry: creation, edits, approvals, rejections, feedback, and status changes."
        size="xl"
        scrollable
      >
        {logTarget && auditLogOf(logTarget).length > 0 ? (
          <ol className="relative space-y-4 pl-1">
            {auditLogOf(logTarget).map((entry, idx) => {
              const entries = auditLogOf(logTarget);
              const meta = ACTION_META[entry.action] || { label: entry.action, icon: <AlertCircle size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' };
              const isLast = idx === entries.length - 1;
              return (
                <li key={`${entry.at}-${idx}`} className="relative pl-6">
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
                      <span className="text-[10px] text-slate-400">→ {entry.status}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</span>
                  </div>
                  {entry.reason && (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
                      {entry.reason}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                    By <span className="font-semibold text-slate-500 dark:text-slate-300">{formatActor(entry.actor)}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="text-center py-8">
            <XCircle className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
            <p className="text-xs text-slate-500">No audit history recorded for this record.</p>
            <p className="text-[10px] text-slate-400 mt-1">Legacy-synced records pre-date the audit log. New sales capture the full workflow automatically.</p>
          </div>
        )}
      </Modal>

      {/* Edit Sales Entry Record Modal */}
      <Modal
        isOpen={showEditInvoiceModal && !!editForm}
        onClose={() => setShowEditInvoiceModal(false)}
        title={`Edit Sales Entry Record — ${editForm?.invoiceNo || ''}`}
        size="md"
        showCloseButton={false}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!editForm || !editForm.invoiceNo || !onUpdateInvoice) return;

            const total = Math.round(Number(editForm.totalAmountBDT || 0) * 100) / 100;
            const paid = Math.round(Number(editForm.paidAmountBDT || 0) * 100) / 100;
            const due = Math.round((total - paid) * 100) / 100;

            const payload = {
              invoiceNo: editForm.invoiceNo,
              date: editForm.date || undefined,
              groupId: editForm.groupId,
              customerId: editForm.customerId,
              serviceType: editForm.serviceType,
              platform: editForm.platform,
              adAccountName: editForm.adAccountName,
              adAccountId: editForm.adAccountId,
              dollarRate: Number(editForm.dollarRate || 0),
              topupAmountUSD: Number(editForm.topupAmountUSD || 0),
              totalAmountBDT: total,
              paidAmountBDT: paid,
              dueAmountBDT: due,
              paymentStatus: editForm.paymentStatus || (due <= 0 && paid > 0 ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Due'),
              paymentMethod: editForm.paymentMethod,
              topupStatus: editForm.topupStatus,
              approvalStatus: editForm.approvalStatus,
              note: editForm.note,
              paymentScreenshot: editForm.paymentScreenshot || undefined,
            };

            try {
              await onUpdateInvoice(payload);
              salesInvoicePages.refetch();
            } catch (err) {
              // The hook already surfaced a toast with the error.
            } finally {
              setShowEditInvoiceModal(false);
              setEditingInvoice(null);
              setEditForm(null);
            }
          }}
          className="space-y-4"
          id="form-edit-invoice"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group ID</label>
              <input
                type="text"
                value={editForm?.groupId || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, groupId: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer</label>
              <select
                value={editForm?.customerId || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, customerId: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="" disabled>Choose Customer</option>
                {(editForm?.groupId ? customers.filter(c => c.groupId === editForm.groupId) : customers).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.companyName})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Type</label>
              <select
                value={editForm?.serviceType || 'Ad Account Topup'}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, serviceType: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Ad Account Topup">Ad Account Topup</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
              <select
                value={editForm?.platform ?? 'Facebook'}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, platform: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Snapchat">Snapchat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ad Account Name</label>
              <input
                type="text"
                value={editForm?.adAccountName ?? ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, adAccountName: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ad Account ID</label>
              <input
                type="text"
                value={editForm?.adAccountId ?? ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, adAccountId: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={editForm?.date ? String(editForm.date).slice(0, 10) : ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, date: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dollar Rate</label>
              <input
                type="number"
                value={editForm?.dollarRate ?? 0}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, dollarRate: Number(e.target.value) } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Topup Amount (USD)</label>
              <input
                type="number"
                value={editForm?.topupAmountUSD ?? 0}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, topupAmountUSD: Number(e.target.value) } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Total Amount (BDT)</label>
              <input
                type="number"
                value={editForm?.totalAmountBDT ?? 0}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, totalAmountBDT: Number(e.target.value) } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Paid Amount (BDT)</label>
              <input
                type="number"
                value={editForm?.paidAmountBDT ?? 0}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, paidAmountBDT: Number(e.target.value) } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Due Amount (BDT) — auto</label>
              <input
                type="text"
                readOnly
                disabled
                value={`৳${Math.round((Number(editForm?.totalAmountBDT || 0) - Number(editForm?.paidAmountBDT || 0)) * 100) / 100}`}
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-lg border border-slate-200 dark:border-slate-800 font-bold cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Method</label>
              <select
                value={editForm?.paymentMethod || ''}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, paymentMethod: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="" disabled>Choose Method</option>
                {paymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Status</label>
              <select
                value={editForm?.paymentStatus || 'Paid'}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, paymentStatus: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Paid">Paid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Due">Due</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Topup Status</label>
              <select
                value={editForm?.topupStatus || 'Successfull'}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, topupStatus: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Successfull">Successful</option>
                <option value="Pending">Pending Sync</option>
                <option value="Failed">Failed / Declined</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Approval Status</label>
              <select
                value={editForm?.approvalStatus || 'Pending'}
                onChange={(e) => setEditForm(prev => prev ? { ...prev, approvalStatus: e.target.value } : prev)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Waiting For Feedback">Waiting For Feedback</option>
                <option value="Final Approval Review">Final Approval Review</option>
                <option value="Finally Rejected">Finally Rejected</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Author Note</label>
            <input
              type="text"
              value={editForm?.note || ''}
              onChange={(e) => setEditForm(prev => prev ? { ...prev, note: e.target.value } : prev)}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>

          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditInvoiceModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Historical / Previous Month Sales Entry Modal */}
      <Modal
        isOpen={showHistModal}
        onClose={() => { if (!histSubmitting) setShowHistModal(false); }}
        title="Historical / Previous Month Sales Entry"
        description="Backfill a sale that occurred before this system was in use. The record is saved to the database and stays in the sales history without affecting current balances, approvals, or the live sales flow."
        size="lg"
        scrollable
        showCloseButton={false}
      >
        <form onSubmit={handleAddHistoricalSale} className="space-y-4" id="form-historical-sale">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Sale Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                max={histMaxDate}
                value={histDate}
                onChange={(e) => setHistDate(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Must be a past date (before today).</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Service Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={histServiceType}
                onChange={(e) => setHistServiceType(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Ad Account Topup">Ad Account Topup</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Group ID <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={histGroupId}
                onChange={(e) => setHistGroupId(e.target.value)}
                placeholder="e.g. GC-SOCIAL-ASSIGN"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Customer <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={histCustomerId}
                onChange={(e) => setHistCustomerId(e.target.value)}
                placeholder="e.g. ADB550001"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
              <select
                value={histPlatform}
                onChange={(e) => setHistPlatform(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dollar Rate (BDT/USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={histDollarRate}
                onChange={(e) => setHistDollarRate(Number(e.target.value))}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Ad Account Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={histAdAccountName}
                onChange={(e) => setHistAdAccountName(e.target.value)}
                placeholder="e.g. ADS_Safirana.com_VH_1377"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Ad Account ID {histServiceType !== 'Others' && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="text"
                value={histAdAccountId}
                onChange={(e) => setHistAdAccountId(e.target.value)}
                placeholder={histServiceType === 'Others' ? 'Optional for Others' : 'e.g. 206893199112660'}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Topup Amount (USD) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={histTopupUSD}
                onChange={(e) => setHistTopupUSD(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Total Amount (BDT)</label>
              <input
                type="text"
                readOnly
                disabled
                value={`৳${histTotalBdt.toLocaleString()}`}
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-lg border border-slate-200 dark:border-slate-800 font-bold cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Paid Amount (BDT) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={histPaidBDT}
                onChange={(e) => setHistPaidBDT(e.target.value)}
                placeholder="0.00"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
            </div>
          </div>

          <div className={`p-3 rounded-xl border text-center text-xs font-bold flex items-center justify-center gap-4 flex-wrap ${
            histDue > 0 ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
          }`}>
            <span className="text-slate-400 font-semibold">Outstanding Due: <span className={histDue > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>৳{histDue.toLocaleString()}</span></span>
            <span className="text-slate-400 font-semibold">Payment Status: <span className={
              histPaymentStatus === 'Paid' ? 'text-emerald-600 dark:text-emerald-400' :
              histPaymentStatus === 'Partially Paid' ? 'text-amber-600 dark:text-amber-400' :
              'text-rose-600 dark:text-rose-400'
            }>{histPaymentStatus}</span></span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Channel</label>
              <select
                required
                value={histPaymentMethod}
                onChange={(e) => setHistPaymentMethod(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                {availablePaymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Topup Status</label>
              <select
                value={histTopupStatus}
                onChange={(e) => setHistTopupStatus(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Successfull">Successful</option>
                <option value="Pending">Pending Sync</option>
                <option value="Failed">Failed / Declined</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Author Note {histPaid <= 0 && <span className="text-rose-500">*</span>}
              {histPaid <= 0 && (
                <span className="ml-2 normal-case font-semibold text-[10px] text-amber-600 dark:text-amber-400">Required when no amount is paid</span>
              )}
            </label>
            <input
              type="text"
              value={histNote}
              onChange={(e) => setHistNote(e.target.value)}
              placeholder="e.g. Historical topup settled via EBL before system launch"
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>

          {histError && (
            <p className="text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/50 p-3 rounded-lg">
              {histError}
            </p>
          )}

          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => { if (!histSubmitting) setShowHistModal(false); }}>Cancel</Button>
            <Button type="submit" disabled={histSubmitting}>Save Historical Sale</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Sales Entry Record Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Sales Entry?"
        message={`This will permanently remove invoice ${deleteTarget?.invoiceNo || ''} (${deleteTarget?.adAccountName || '—'}) from the Sales Entry Records. This action cannot be undone.`}
        confirmLabel="Delete Entry"
        variant="danger"
      />

    </div>
  );
}

export default memo(SalesView);

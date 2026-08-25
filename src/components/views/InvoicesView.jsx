'use client';
import { memo, useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  Calendar,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  CopyCheck,
  FileClock,
  FileEdit,
  FileText,
  History,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  XOctagon,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FieldError from '@/components/ui/FieldError';
import { validate, hasErrors, positiveNumber } from '@/utils/formValidation';
import { uploadScreenshot } from '@/utils/api';

const ACTION_META = {
  created: { label: 'Entry Created', icon: <FileClock size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  edited: { label: 'Entry Edited', icon: <FileEdit size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  approved: { label: 'Approved', icon: <ThumbsUp size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  rejected: { label: 'Rejected — Waiting for Feedback', icon: <ThumbsDown size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  feedback_submitted: { label: 'Feedback Submitted', icon: <MessageSquare size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  final_approved: { label: 'Final Approval Granted', icon: <CheckCheck size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  final_rejected: { label: 'Finally Rejected', icon: <XOctagon size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  status_synced: { label: 'Topup Status Synced', icon: <RefreshCw size={13} />, tone: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-400' },
  payment_received: { label: 'Payment Received', icon: <Banknote size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
};

function formatActor(actor) {
  if (!actor) return 'System';
  return actor.name || actor.email || actor.uid || 'System';
}

function auditLogOf(inv) {
  return Array.isArray(inv?.auditLog) ? inv.auditLog : [];
}

function paymentsOf(inv) {
  return Array.isArray(inv?.payments) ? inv.payments : [];
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function InvoicesView({ invoices, customers, onUpdateInvoice, onRecordPayment, loading, error, onRetry, paymentMethods }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormErrors, setEditFormErrors] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Record Payment modal state
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amountBDT: '',
    paymentMethod: '',
    date: todayStr(),
    transactionId: '',
    note: '',
    screenshot: null,
    screenshotName: '',
  });
  const [paymentFormErrors, setPaymentFormErrors] = useState({});
  const [screenshotError, setScreenshotError] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  // View Log modal state
  const [logTarget, setLogTarget] = useState(null);

  // Per-record Copy Invoice feedback
  const [copiedRecord, setCopiedRecord] = useState('');

  const getCustName = (id) => {
    return customers.find(c => c.id === id)?.name || "Cash Client";
  };

  const filtered = invoices.filter(inv => {
    const custName = getCustName(inv.customerId).toLowerCase();
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      (inv.groupId && inv.groupId.toLowerCase().includes(search.toLowerCase())) ||
      inv.adAccountName.toLowerCase().includes(search.toLowerCase()) ||
      custName.includes(search.toLowerCase()) ||
      (inv.serviceDetails && inv.serviceDetails.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' ? true : inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageWindow = (() => {
    const pages = [];
    const max = totalPages;
    const current = safePage;
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(max - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < max - 2) pages.push('...');
    if (max > 1) pages.push(max);
    return pages;
  })();

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Date metrics calculations for Overview Cards
  const todayStrFor = todayStr();
  const currentMonthStr = todayStrFor.substring(0, 7);

  const hasCurrentMonthInvoices = invoices.some(i => i.date && i.date.startsWith(currentMonthStr));
  const activeMonthStr = hasCurrentMonthInvoices
    ? currentMonthStr
    : (invoices.length > 0 && invoices[0].date ? invoices[0].date.substring(0, 7) : currentMonthStr);

  const monthNameLabel = (() => {
    const [y, m] = activeMonthStr.split('-');
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  })();

  const currentMonthInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(activeMonthStr));
  const currentMonthInvoicesCount = currentMonthInvoices.length;
  const currentMonthUSD = currentMonthInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentMonthBDT = currentMonthInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  const currentMonthOthers = currentMonthInvoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const currentMonthOthersUSD = currentMonthOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentMonthOthersBDT = currentMonthOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // Daily (Today)
  const hasTodayInvoices = invoices.some(i => i.date === todayStrFor);
  const activeTodayStr = hasTodayInvoices
    ? todayStrFor
    : (invoices.length > 0 && invoices[0].date ? invoices[0].date : todayStrFor);

  const dailyInvoices = invoices.filter(inv => inv.date === activeTodayStr);
  const dailyInvoicesCount = dailyInvoices.length;
  const dailyUSD = dailyInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const dailyBDT = dailyInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  const dailyOthers = dailyInvoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const dailyOthersUSD = dailyOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const dailyOthersBDT = dailyOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // Lifetime (All-Time) metrics
  const lifetimeInvoicesCount = invoices.length;
  const lifetimeUSD = invoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const lifetimeBDT = invoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);
  const lifetimeOthers = invoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const lifetimeOthersUSD = lifetimeOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const lifetimeOthersBDT = lifetimeOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // Current Year metrics
  const currentYearStr = todayStrFor.substring(0, 4);
  const currentYearInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(currentYearStr));
  const currentYearInvoicesCount = currentYearInvoices.length;
  const currentYearUSD = currentYearInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentYearBDT = currentYearInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);
  const currentYearOthers = currentYearInvoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const currentYearOthersUSD = currentYearOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentYearOthersBDT = currentYearOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // Payment status summary (Amount received for Paid/Partially Paid, outstanding for Due)
  const summarizePayments = (list) => {
    const byStatus = (status, amountKey) => {
      const items = list.filter(inv => inv.paymentStatus === status);
      return {
        count: items.length,
        bdt: items.reduce((sum, inv) => sum + (Number(inv[amountKey]) || 0), 0),
      };
    };
    return {
      paid: byStatus('Paid', 'paidAmountBDT'),
      partiallyPaid: byStatus('Partially Paid', 'paidAmountBDT'),
      due: byStatus('Due', 'dueAmountBDT'),
    };
  };

  const lifetimePaymentSummary = summarizePayments(invoices);
  const currentMonthPaymentSummary = summarizePayments(currentMonthInvoices);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingInvoice || !onUpdateInvoice) return;
    const errors = validate(
      {
        usd: editingInvoice.topupAmountUSD,
        bdt: editingInvoice.totalAmountBDT,
      },
      {
        usd: positiveNumber('Topup amount must be greater than 0'),
        bdt: positiveNumber('Total amount (BDT) must be greater than 0'),
      },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});
    onUpdateInvoice(editingInvoice);
    setShowEditModal(false);
    setEditingInvoice(null);
  };

  const openPaymentModal = (inv) => {
    setPaymentTarget({ ...inv });
    setPaymentForm({
      amountBDT: '',
      paymentMethod: inv.paymentMethod && inv.paymentMethod !== 'N/A' ? inv.paymentMethod : '',
      date: todayStr(),
      transactionId: '',
      note: '',
      screenshot: null,
      screenshotName: '',
    });
    setPaymentFormErrors({});
    setScreenshotError('');
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentTarget || !onRecordPayment) return;
    const due = Number(paymentTarget.dueAmountBDT || 0);
    const amount = Number(paymentForm.amountBDT);
    const errors = {};
    if (paymentForm.amountBDT === '' || !Number.isFinite(amount) || amount <= 0) {
      errors.amountBDT = 'Enter a positive payment amount';
    } else if (amount > due) {
      errors.amountBDT = `Amount cannot exceed the remaining due of ৳${due.toLocaleString()}`;
    }
    if (hasErrors(errors)) {
      setPaymentFormErrors(errors);
      return;
    }
    setPaymentFormErrors({});
    setPaymentSubmitting(true);

    let screenshotUrl = '';
    if (paymentForm.screenshot) {
      try {
        screenshotUrl = await uploadScreenshot({
          name: paymentForm.screenshotName || 'payment-screenshot.png',
          data: paymentForm.screenshot,
        });
      } catch (uploadErr) {
        setScreenshotError('Screenshot upload failed. Please try again.');
        setPaymentSubmitting(false);
        return;
      }
    }

    onRecordPayment(paymentTarget.invoiceNo, {
      amountBDT: amount,
      paymentMethod: paymentForm.paymentMethod,
      date: paymentForm.date,
      transactionId: paymentForm.transactionId,
      note: paymentForm.note,
      screenshot: screenshotUrl,
      customerId: paymentTarget.customerId,
    })
      .then(() => {
        setShowPaymentModal(false);
        setPaymentTarget(null);
        setScreenshotError('');
      })
      .catch(() => { })
      .finally(() => {
        setPaymentSubmitting(false);
      });
  };

  const buildCopyText = (inv) => {
    return [
      `Date: ${inv.date || ''}`,
      `Invoice No: ${inv.invoiceNo || ''}`,
      `Group ID: ${inv.groupId || ''}`,
      `Platform Name: ${inv.platform || ''}`,
      `Ad Account Name: ${inv.adAccountName || ''}`,
      `Ad Account ID: ${inv.adAccountId || ''}`,
      `USD Dollar Rate: ${inv.dollarRate || 0}`,
      `Amount in USD: ${inv.topupAmountUSD || 0}`,
      `Amount in BDT: ${inv.totalAmountBDT || 0}`,
      `Payment Status: ${inv.paymentStatus || ''}`,
      `TopUp Status: ${inv.topupStatus || ''}`,
      `Paid Amount: ${Number.isFinite(Number(inv.paidAmountBDT)) ? inv.paidAmountBDT : 0}`,
      `Due Amount: ${Number.isFinite(Number(inv.dueAmountBDT)) ? inv.dueAmountBDT : 0}`,
    ].join('\n');
  };

  const handleCopyInvoice = (inv) => {
    if (typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(buildCopyText(inv))
      .then(() => {
        setCopiedRecord(inv.invoiceNo);
        setTimeout(() => setCopiedRecord(''), 2000);
      })
      .catch(() => { });
  };

  // Payment methods available in the Record Payment modal: the configured
  // settings methods plus any method already associated with the invoice.
  const availablePaymentMethods = (() => {
    const methods = new Set((paymentMethods || []).map(m => String(m).trim()).filter(Boolean));
    const existing = String(paymentTarget?.paymentMethod || '').trim();
    if (existing) methods.add(existing);
    return Array.from(methods);
  })();

  return (
    <div className="space-y-6 animate-fade-in">
      <ErrorBanner error={error} onRetry={onRetry} />

      {loading && invoices.length === 0 && !error && (
        <div className="bg-white dark:bg-slate-900 p-10 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            Loading invoices from the database…
          </p>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transaction Ledger</h1>
        <p className="text-sm text-slate-500">Historical database of all top-up invoice settlements.</p>
      </div>

      {/* Top Short Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Month Overview Card */}
        <div className="bg-surface-blue dark:bg-surface-blue p-5 rounded-2xl border border-border-blue dark:border-border-blue space-y-3">
          <div className="flex justify-between items-center border-b border-border-blue dark:border-border-blue pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue-deep dark:text-brand-blue-deep flex items-center gap-1.5">
              <Calendar size={14} className="text-brand-blue-dark dark:text-brand-blue-dark" />
              {monthNameLabel}
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-brand-blue-deep dark:text-brand-blue-deep border border-border-blue dark:border-border-blue">
              Monthly Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue dark:border-border-blue shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Invoice</p>
              <p className="text-xl font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">{currentMonthInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-brand-blue-deep/65 dark:text-brand-blue-deep/65">Monthly records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue dark:border-border-blue shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Sell (USD &amp; BDT)</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentMonthUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{currentMonthBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue dark:border-border-blue shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Other Services</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentMonthOthersUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{currentMonthOthersBDT.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Daily Overview Card */}
        <div className="bg-surface-green dark:bg-surface-green p-5 rounded-2xl border border-border-green dark:border-border-green space-y-3">
          <div className="flex justify-between items-center border-b border-border-green dark:border-border-green pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-status-green-deep dark:text-status-green-deep flex items-center gap-1.5">
              <Clock size={14} className="text-status-green-deep dark:text-status-green-deep" />
              Daily ({activeTodayStr})
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-status-green-deep dark:text-status-green-deep border border-border-green dark:border-border-green">
              Today Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-black text-status-green-deep dark:text-status-green-deep mt-1">{dailyInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-status-green-deep/65 dark:text-status-green-deep/65">Today records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Sell (USD &amp; BDT)</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep mt-1">${dailyUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep">৳{dailyBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Others Service Sell</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep mt-1">${dailyOthersUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep">৳{dailyOthersBDT.toLocaleString()}</p>
            </div>
          </div>

        </div>
        {/* Lifetime Legendary Overview Card */}
        <div className="bg-surface-rose dark:bg-surface-rose p-5 rounded-2xl border border-border-rose dark:border-border-rose space-y-3">
          <div className="flex justify-between items-center border-b border-border-rose dark:border-border-rose pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue-deep dark:text-brand-blue-deep flex items-center gap-1.5">
              <Award size={14} className="text-brand-orange-dark dark:text-brand-orange-dark" />
              Lifetime Legendary
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-brand-blue-deep dark:text-brand-blue-deep border border-border-rose dark:border-border-rose">
              All-Time Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-rose dark:border-border-rose shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">{lifetimeInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-brand-blue-deep/65 dark:text-brand-blue-deep/65">Lifetime records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-rose dark:border-border-rose shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Sales (USD &amp; BDT)</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${lifetimeUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{lifetimeBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-rose dark:border-border-rose shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Other Service Sales</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${lifetimeOthersUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{lifetimeOthersBDT.toLocaleString()}</p>
            </div>
          </div>
        </div>
        {/* Current Year Legendary Overview Card */}
        <div className="bg-surface-orange dark:bg-surface-orange p-5 rounded-2xl border border-border-orange dark:border-border-orange space-y-3">
          <div className="flex justify-between items-center border-b border-border-orange dark:border-border-orange pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue-deep dark:text-brand-blue-deep flex items-center gap-1.5">
              <Calendar size={14} className="text-brand-orange-dark dark:text-brand-orange-dark" />
              Current Year ({currentYearStr})
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-brand-blue-deep dark:text-brand-blue-deep border border-border-orange dark:border-border-orange">
              Yearly Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">{currentYearInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-brand-blue-deep/65 dark:text-brand-blue-deep/65">Yearly records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Sales (USD &amp; BDT)</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentYearUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{currentYearBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-orange dark:border-border-orange shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Other Service Sales</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentYearOthersUSD.toLocaleString()}</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep">৳{currentYearOthersBDT.toLocaleString()}</p>
            </div>
          </div>
        </div>


      </div>





      {/* Payment Status Insights Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Banknote size={14} className="text-emerald-600 dark:text-emerald-400" />
            Payment Status Insights
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-brand-blue-deep dark:text-brand-blue-deep border border-slate-200 dark:border-slate-700">
            All-Time Summary
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-xs">
            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Paid</p>
            <p className="text-sm font-black text-emerald-800 dark:text-emerald-300 mt-1">৳{lifetimePaymentSummary.paid.bdt.toLocaleString()}</p>
            <p className="text-[9px] font-semibold text-emerald-700/70 dark:text-emerald-400/70">{lifetimePaymentSummary.paid.count} transactions</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-500/10 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 shadow-xs">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Partially Paid</p>
            <p className="text-sm font-black text-amber-800 dark:text-amber-300 mt-1">৳{lifetimePaymentSummary.partiallyPaid.bdt.toLocaleString()}</p>
            <p className="text-[9px] font-semibold text-amber-700/70 dark:text-amber-400/70">{lifetimePaymentSummary.partiallyPaid.count} transactions</p>
          </div>
          <div className="bg-rose-50 dark:bg-rose-500/10 p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 shadow-xs">
            <p className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wide">Due</p>
            <p className="text-sm font-black text-rose-800 dark:text-rose-300 mt-1">৳{lifetimePaymentSummary.due.bdt.toLocaleString()}</p>
            <p className="text-[9px] font-semibold text-rose-700/70 dark:text-rose-400/70">{lifetimePaymentSummary.due.count} transactions</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <SearchBar
          maxWidthClass="w-full sm:max-w-xs"
          placeholder="Search invoice or group code..."
          value={search}
          onChange={(value) => setSearch(value)}
        />
        <div className="flex gap-2 w-full sm:w-auto">
          {(['All', 'Paid', 'Due', 'Partially Paid']).map(st => {
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`text-xs font-black px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs text-white ${isSelected
                    ? 'bg-brand-blue border-brand-blue ring-2 ring-blue-500/40 scale-105 opacity-100'
                    : 'bg-brand-blue-dark border-brand-blue-dark opacity-85 hover:opacity-100 hover:scale-102'
                  }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse min-w-[1180px]">
            <thead className="bg-brand-blue text-white font-bold tracking-tight">
              <tr>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Date</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[11%]">Invoice No</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[6%]">Group ID</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[16%]">Ad Account Name</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Amount USD</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">BDT</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Paid Amount</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Due Amount</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Payment Status</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Approval Status</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[11%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {paginated.map(inv => {
                const displayGroupId = inv.groupId || 'N/A';
                const adAccountOrService = inv.serviceType === 'Others'
                  ? (inv.serviceDetails || inv.adAccountName || 'Other Service')
                  : inv.adAccountName;
                const approvalStatus = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved';
                const canPay = inv.paymentStatus === 'Due' || inv.paymentStatus === 'Partially Paid';
                const logEntries = auditLogOf(inv);

                return (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-medium text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] truncate">{inv.date || '—'}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-slate-900 dark:text-white font-mono text-[10px] sm:text-[11px] truncate" title={inv.invoiceNo}>{inv.invoiceNo}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-mono font-medium text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] truncate">{displayGroupId}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-semibold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px] truncate" title={adAccountOrService}>
                      {adAccountOrService}
                    </td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-black text-slate-900 dark:text-white text-[10px] sm:text-[11px]">${(inv.topupAmountUSD || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px]">৳{(inv.totalAmountBDT || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-[11px]">৳{(inv.paidAmountBDT || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-rose-600 dark:text-rose-400 text-[10px] sm:text-[11px]">৳{(inv.dueAmountBDT || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-0.5 sm:px-1 text-center">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold truncate max-w-full ${inv.paymentStatus === 'Paid' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                          inv.paymentStatus === 'Partially Paid' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                            'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-0.5 sm:px-1 text-center">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold truncate max-w-full ${approvalStatus === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                          approvalStatus === 'Pending' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                            'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                        {approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="compact"
                          onClick={() => {
                            setEditingInvoice({ ...inv });
                            setShowEditModal(true);
                          }}
                          leftIcon={<FileEdit size={10} />}
                        >
                          Edit
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleCopyInvoice(inv)}
                          className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg border cursor-pointer transition-colors ${copiedRecord === inv.invoiceNo
                              ? 'bg-emerald-500 text-white border-emerald-500'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                            }`}
                        >
                          {copiedRecord === inv.invoiceNo ? <CopyCheck size={10} /> : <Copy size={10} />}
                          {copiedRecord === inv.invoiceNo ? 'Copied' : 'Copy Invoice'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogTarget(inv)}
                          className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-800/60 cursor-pointer transition-colors"
                        >
                          <History size={10} /> View Log {logEntries.length > 0 && `(${logEntries.length})`}
                        </button>
                        {canPay && (
                          <button
                            type="button"
                            onClick={() => openPaymentModal(inv)}
                            className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 cursor-pointer transition-colors"
                          >
                            <Banknote size={10} /> Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400 italic">
                    No invoices match search or selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} invoices
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              {pageWindow.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${p === safePage
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Invoice Modal */}
      <Modal
        isOpen={showEditModal && !!editingInvoice}
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); }}
        title={`Edit Invoice Record #${editingInvoice?.invoiceNo ?? ''}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" id="form-edit-invoice-modal">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Invoice No</label>
              <input
                type="text"
                value={editingInvoice?.invoiceNo ?? ''}
                readOnly
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 font-mono cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group ID</label>
              <input
                type="text"
                value={editingInvoice?.groupId || ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, groupId: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer</label>
              <select
                value={editingInvoice?.customerId || ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, customerId: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={editingInvoice?.date ?? ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ad Account Name / Services</label>
            <input
              type="text"
              value={editingInvoice?.adAccountName ?? ''}
              onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, adAccountName: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount in USD ($)</label>
              <input
                type="number"
                value={editingInvoice?.topupAmountUSD ?? 0}
                onChange={(e) => {
                  if (!editingInvoice) return;
                  const usd = Number(e.target.value);
                  const rate = editingInvoice.dollarRate || 130;
                  setEditingInvoice({
                    ...editingInvoice,
                    topupAmountUSD: usd,
                    totalAmountBDT: usd * rate,
                    paidAmountBDT: editingInvoice.paymentStatus === 'Paid' ? usd * rate : editingInvoice.paidAmountBDT
                  });
                }}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
              <FieldError error={editFormErrors.usd} />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">BDT Total (৳)</label>
              <input
                type="number"
                value={editingInvoice?.totalAmountBDT ?? 0}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, totalAmountBDT: Number(e.target.value) })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
              <FieldError error={editFormErrors.bdt} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Status</label>
              <select
                value={editingInvoice?.paymentStatus ?? 'Paid'}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, paymentStatus: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Paid">Paid</option>
                <option value="Due">Due</option>
                <option value="Partially Paid">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Approval Status</label>
              <select
                value={editingInvoice?.approvalStatus || 'Approved'}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, approvalStatus: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" variant="secondary">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal && !!paymentTarget}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentTarget(null);
          setPaymentFormErrors({});
        }}
        title={`Record Payment — ${paymentTarget?.invoiceNo ?? ''}`}
        description="Enter the BDT amount received against this invoice. Paid, due, and payment status are updated automatically."
        size="lg"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4" id="form-record-payment-modal">
          {paymentTarget && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Total BDT</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">৳{(paymentTarget.totalAmountBDT || 0).toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-800 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-500">Paid</p>
                <p className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-0.5">৳{(paymentTarget.paidAmountBDT || 0).toLocaleString()}</p>
              </div>
              <div className="bg-rose-50 dark:bg-rose-500/10 rounded-xl border border-rose-200 dark:border-rose-800 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-rose-500">Due</p>
                <p className="text-sm font-black text-rose-700 dark:text-rose-400 mt-0.5">৳{(paymentTarget.dueAmountBDT || 0).toLocaleString()}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Amount (৳ BDT)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={paymentForm.amountBDT}
              onChange={(e) => setPaymentForm({ ...paymentForm, amountBDT: e.target.value })}
              placeholder={paymentTarget ? `Up to ৳${(paymentTarget.dueAmountBDT || 0).toLocaleString()}` : 'Enter amount received'}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
            />
            <FieldError error={paymentFormErrors.amountBDT} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="">Select Payment Method</option>
                {availablePaymentMethods.map(pm => (
                  <option key={pm} value={pm}>{pm}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Date</label>
              <input
                type="date"
                value={paymentForm.date}
                onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Transaction ID (optional)</label>
              <input
                type="text"
                value={paymentForm.transactionId}
                onChange={(e) => setPaymentForm({ ...paymentForm, transactionId: e.target.value })}
                placeholder="e.g. TXN-123456"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reference / Note (optional)</label>
              <input
                type="text"
                value={paymentForm.note}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="Any reference for this payment"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Screenshot (optional)</label>
            <div className="space-y-2">
              {paymentForm.screenshot && paymentForm.screenshotName ? (
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <img src={paymentForm.screenshot} alt="Screenshot preview" className="h-12 w-12 object-cover rounded-lg border" />
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate max-w-xs">{paymentForm.screenshotName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPaymentForm({ ...paymentForm, screenshot: null, screenshotName: '' })}
                    className="text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      setScreenshotError('');
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith('image/')) {
                        setScreenshotError('Please upload a valid image file (PNG, JPG, JPEG, WebP, GIF).');
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setScreenshotError(`Image is too large. Maximum allowed size is 5 MB.`);
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPaymentForm({
                          ...paymentForm,
                          screenshot: typeof reader.result === 'string' ? reader.result : undefined,
                          screenshotName: file.name,
                        });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="hidden"
                    id="payment-screenshot-input"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('payment-screenshot-input')?.click()}
                    leftIcon={<FileText size={14} />}
                  >
                    Upload Screenshot
                  </Button>
                  <p className="text-[10px] text-slate-500 mt-1">PNG, JPG, WebP, GIF up to 5MB</p>
                </div>
              )}
              {screenshotError && <p className="text-[10px] text-rose-500">{screenshotError}</p>}
            </div>
          </div>

          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => { setShowPaymentModal(false); setPaymentTarget(null); }}>Cancel</Button>
            <Button type="submit" variant="secondary" leftIcon={<Banknote size={12} />} disabled={paymentSubmitting}>
              {paymentSubmitting ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Log modal */}
      <Modal
        isOpen={!!logTarget}
        onClose={() => setLogTarget(null)}
        title={`Activity Log — ${logTarget?.invoiceNo ?? ''}`}
        description="Complete workflow + payment history for this invoice: creation, edits, approvals, rejections, and every payment received."
        size="xl"
        scrollable
      >
        {logTarget && paymentsOf(logTarget).length > 0 && (
          <div className="mb-6">
            <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mb-2">
              <Banknote size={12} /> Payment History ({paymentsOf(logTarget).length})
            </h4>
            <div className="space-y-2">
              {paymentsOf(logTarget).map((p, idx) => (
                <div key={`${p.at}-${idx}`} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                      ৳{Number(p.amountBDT || 0).toLocaleString()} received{p.paymentMethod && p.paymentMethod !== 'N/A' ? ` via ${p.paymentMethod}` : ''}
                    </p>
                    {p.transactionId && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">TXN: <span className="font-mono">{p.transactionId}</span></p>
                    )}
                    {p.note && <p className="text-[10px] text-slate-500 dark:text-slate-400">{p.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{p.date || new Date(p.at).toISOString().split('T')[0]}</p>
                    <p className="text-[10px] text-slate-400">
                      By <span className="font-semibold text-slate-500 dark:text-slate-300">{formatActor(p.actor)}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
    </div>
  );
}

export default memo(InvoicesView);

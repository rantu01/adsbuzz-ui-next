'use client';

import React, { memo, useEffect, useMemo, useState } from 'react';
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
  CopyCheck
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { apiFetch } from '@/utils/api';

const STEP_HEADERS = [
  { id: 1, name: 'Select Customer & Account' },
  { id: 2, name: 'Configure Payment' },
  { id: 3, name: 'Payment Summary' }
];

function SalesView({
  customers,
  adAccounts,
  invoices = [],
  paymentMethods,
  onSubmitSale,
  onUpdateInvoice,
  onNavigateToCustomers,
  initialCheckoutStep,
  initialCustomerId,
}) {
  const [currentStep, setCurrentStep] = useState(initialCheckoutStep ?? 1);
  
  // Service Type & Group ID Code
  const [serviceType, setServiceType] = useState('Ad Account Topup');
  const [groupIdCode, setGroupIdCode] = useState('');

  // Build deduplicated list of available Group IDs (from existing customers + sale setups)
  const groupIdOptions = React.useMemo(() => {
    const ids = new Set();
    customers.forEach(c => { if (c.groupId) ids.add(c.groupId); });
    invoices.forEach(inv => { if (inv.groupId) ids.add(inv.groupId); });
    return Array.from(ids).sort();
  }, [customers, invoices]);

  // Customers belonging to the selected group
  const customersInGroup = React.useMemo(
    () => customers.filter(c => !groupIdCode || c.groupId === groupIdCode),
    [customers, groupIdCode]
  );

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

  // Sales records pagination state
  const RECORDS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(invoices.length / RECORDS_PER_PAGE));
  const clampedPage = Math.min(currentPage, totalPages);
  const paginatedInvoices = invoices.slice(
    (clampedPage - 1) * RECORDS_PER_PAGE,
    clampedPage * RECORDS_PER_PAGE
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Checkout State
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || customers[0]?.id || '');
  const [platform, setSelectedPlatform] = useState('Facebook');

  // When a customer is pre-selected (e.g. from the Customers page), sync the group
  useEffect(() => {
    if (selectedCustomerId) {
      const c = customers.find(x => x.id === selectedCustomerId);
      if (c && c.groupId) setGroupIdCode(c.groupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId]);

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

  // Calculations State
  const [dollarRate, setDollarRate] = useState(132);
  const [topupAmountUSD, setTopupAmountUSD] = useState(100);
  const [totalBDT, setTotalBDT] = useState(13200);
  const [paidBDT, setPaidBDT] = useState(13200);
  const [dueBDT, setDueBDT] = useState(0);
  
  // Payment Details State
  const [paymentMethod, setPaymentMethod] = useState(paymentMethods[0]);
  const [topupStatus, setTopupStatus] = useState('Successfull');
  const [approvalStatus, setApprovalStatus] = useState('Pending');
  const [noteText, setNoteText] = useState('');

  // Payment Screenshot (data URL)
  const [paymentScreenshot, setPaymentScreenshot] = useState(undefined);
  const [screenshotName, setScreenshotName] = useState('');
  const [screenshotError, setScreenshotError] = useState('');

  const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleScreenshotUpload = (e) => {
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
      setPaymentScreenshot(typeof reader.result === 'string' ? reader.result : undefined);
      setScreenshotName(file.name);
    };
    reader.onerror = () => {
      setScreenshotError('Failed to read the uploaded file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = () => {
    setPaymentScreenshot(undefined);
    setScreenshotName('');
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
  
  // Accounts matching selected platform AND assigned to the selected customer
  const platformAccounts = adAccounts.filter(acc =>
    acc.platform === platform &&
    acc.assignedCustomer === selectedCustomerId
  );

  // True when the customer actually paid something (Paid Amount > 0)
  const hasPaidAmount = Number.isFinite(paidBDT) && paidBDT > 0;

  // Auto-set the first account when platform changes or customer changes
  useEffect(() => {
    if (platformAccounts.length > 0) {
      setSelectedAccountId(platformAccounts[0].adAccountId);
      setDollarRate(platformAccounts[0].dollarRate || 132);
    } else {
      setSelectedAccountId('');
      setDollarRate(132);
    }
  }, [platform, selectedCustomerId]);

  // When selected account changes, update the loaded rate
  const activeAccount = adAccounts.find(acc => acc.adAccountId === selectedAccountId);

  // Topups taken by the selected account AFTER it was assigned to this customer
  const matchingAccountInvoices = React.useMemo(() => {
    if (!activeAccount || !selectedCustomerId) return [];
    const assignedAt = activeAccount.assignedAt ? new Date(activeAccount.assignedAt).getTime() : null;
    return invoices.filter(inv => {
      const sameAccount =
        (inv.adAccountId && inv.adAccountId === activeAccount.adAccountId) ||
        (inv.adAccountName && inv.adAccountName.toLowerCase() === activeAccount.adAccountName.toLowerCase());
      if (!sameAccount) return false;
      // Only topups belonging to this customer
      if (inv.customerId && inv.customerId !== selectedCustomerId) return false;
      // Only topups taken after the account was assigned to this customer
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
  }, [activeAccount, selectedCustomerId, invoices]);

  useEffect(() => {
    if (activeAccount) {
      const rate = activeAccount.dollarRate || 132;
      setDollarRate(rate);
      // Default: customer has paid the full BDT total so status is "Paid"
      setPaidBDT(Math.round(topupAmountUSD * rate * 100) / 100);
    }
  }, [selectedAccountId, activeAccount]);

  // Handle live calculations
  useEffect(() => {
    const total = Math.round(topupAmountUSD * dollarRate * 100) / 100;
    setTotalBDT(total);
  }, [topupAmountUSD, dollarRate]);

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
      if (!selectedCustomerId) {
        setValidationError('Please select a customer before continuing.');
        return;
      }
      if (!platform) {
        setValidationError('Please select a publisher platform before continuing.');
        return;
      }
      if (!selectedAccountId) {
        setValidationError('Please select a target ad account before continuing.');
        return;
      }
      setValidationError('');
    }

    if (currentStep === 2) {
      if (!topupAmountUSD || topupAmountUSD <= 0) {
        setValidationError('Please enter a valid amount the customer paid (greater than 0).');
        return;
      }
      if (!hasPaidAmount) {
        if (!noteText || !noteText.trim()) {
          setValidationError('An Author Note is required when no amount is paid (Paid Amount is empty or 0).');
          return;
        }
      } else if (!paymentScreenshot) {
        setValidationError('Please upload a payment screenshot before continuing.');
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
        if (!selectedCustomerId) {
          setValidationError('Please select a customer before continuing.');
          return;
        }
        if (!platform) {
          setValidationError('Please select a publisher platform before continuing.');
          return;
        }
        if (!selectedAccountId) {
          setValidationError('Please select a target ad account before continuing.');
          return;
        }
      }

      if (tempStep === 2) {
        if (!topupAmountUSD || topupAmountUSD <= 0) {
          setValidationError('Please enter a valid amount the customer paid (greater than 0).');
          return;
        }
        if (!hasPaidAmount) {
          if (!noteText || !noteText.trim()) {
            setValidationError('An Author Note is required when no amount is paid (Paid Amount is empty or 0).');
            return;
          }
        } else if (!paymentScreenshot) {
          setValidationError('Please upload a payment screenshot before continuing.');
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
    if (!selectedCustomerId || !selectedAccountId) return;

    onSubmitSale({
      platform,
      customerId: selectedCustomerId,
      groupId: groupIdCode,
      serviceType,
      adAccountName: activeAccount?.adAccountName || "Unknown Account",
      adAccountId: selectedAccountId,
      dollarRate,
      topupAmountUSD,
      totalAmountBDT: totalBDT,
      paidAmountBDT: Number.isFinite(paidBDT) ? paidBDT : 0,
      dueAmountBDT: Number.isFinite(dueBDT) ? dueBDT : 0,
      paymentStatus: dueBDT <= 0 ? 'Paid' : paidBDT > 0 ? 'Partially Paid' : 'Due',
      paymentMethod,
      topupStatus,
      approvalStatus,
      paymentScreenshot,
      screenshotName: screenshotName || undefined,
      note: noteText || undefined
    });

    // Reset checkout state
    setCurrentStep(1);
    setTopupAmountUSD(100);
    setPaidBDT(13200);
    setNoteText('');
    setPaymentScreenshot(undefined);
    setScreenshotName('');
    setScreenshotError('');
  };

  // STEP 5 — LIVE CHECKOUT INVOICE copy
  const [copied, setCopied] = useState(false);

  const buildInvoiceText = () => {
    const date = new Date().toLocaleDateString('en-GB');
    const invNo = previewInvoiceNo || `ADB ${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}000`;
    const platformName = `${platform} Ad Account`;
    const topupLabel = topupStatus === 'Successfull' ? 'Successful' : topupStatus;
    const paymentLabel = paymentStatusBadge.label;
    return [
      `Date: ${date}`,
      `Invoice no: ${invNo}`,
      `Group ID: ${groupIdCode || ''}`,
      `Platform Name: ${platformName}`,
      `Ad Account Name: ${activeAccount?.adAccountName || ''}`,
      `Ad Account ID: ${activeAccount?.adAccountId || ''}`,
      `USD Dollar rate: ${dollarRate}`,
      `Amount in USD: ${topupAmountUSD}`,
      `Amount in BDT: ${totalBDT}`,
      `Payment Status: ${paymentLabel}`,
      `TopUp Status: ${topupLabel}`,
      `Paid Amount: ${Number.isFinite(paidBDT) ? paidBDT : 0}`,
      `Due Amount: ${Number.isFinite(dueBDT) ? dueBDT : 0}`,
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

  return (
    <div className="space-y-8 pb-12 animate-fade-in" id="sales-view">
      
      {/* Checkout Steps Indicator */}
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
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Service Type</label>
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
                </div>

                {/* 2. Group ID + Platform */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Group ID</label>
                    <select
                      id="checkout-group-id"
                      required
                      value={groupIdCode}
                      onChange={(e) => {
                        const gid = e.target.value;
                        setGroupIdCode(gid);
                        const firstInGroup = customers.find(c => c.groupId === gid);
                        setSelectedCustomerId(firstInGroup ? firstInGroup.id : '');
                      }}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
                    >
                      <option value="" disabled>Select Group ID</option>
                      {groupIdOptions.map(id => (
                        <option key={id} value={id}>{id}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1.5">
                      {customersInGroup.length} customer{customersInGroup.length === 1 ? '' : 's'} in this group.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Platform</label>
                    <select
                      value={platform}
                      onChange={(e) => setSelectedPlatform(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-medium"
                    >
                      <option value="Facebook">Facebook</option>
                      <option value="TikTok">TikTok</option>
                      <option value="Google">Google</option>
                      <option value="Snapchat">Snapchat</option>
                    </select>
                  </div>
                </div>

                {/* 3. Client Information */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Existing Customer</label>
                    <select
                      id="checkout-customer-select"
                      required
                      className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                    >
                      <option value="" disabled>Choose Customer</option>
                      {customersInGroup.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.companyName})</option>
                      ))}
                    </select>
                  </div>

                  {activeCustomer && (
                    <div className="p-4 rounded-xl border border-blue-50 dark:border-blue-950/20 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-brand-blue dark:text-blue-400">Client Information</h4>
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
                  )}
                </div>

                {/* 4. Target Ad Account (assigned to this customer only) */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Target Ad Account</label>
                    {platformAccounts.length === 0 ? (
                      <div className="p-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-100 rounded-xl">
                        {selectedCustomerId
                          ? <>No {platform} ad accounts are currently assigned to this client. Go to <span className="font-bold underline cursor-pointer" onClick={onNavigateToCustomers}>Ad Accounts inventory</span> to assign one.</>
                          : 'Please select a Group ID / customer first to see their assigned ad accounts.'}
                      </div>
                    ) : (
                      <select
                        id="checkout-account-select"
                        required
                        className="w-full text-xs p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                      >
                        {platformAccounts.map(acc => (
                          <option key={acc.adAccountId} value={acc.adAccountId}>
                            {acc.adAccountName} (ID: ...{acc.adAccountId.slice(-6)}) - Rate: ৳{acc.dollarRate}
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
                          <span className="text-sky-800 dark:text-sky-300 font-medium">Assigned To Customer:</span>
                          <span className="font-mono font-bold text-sky-950 dark:text-sky-100">{activeCustomer?.name || activeAccount.assignedCustomer || "Unassigned"}</span>
                        </div>

                        <div className="pt-1.5 border-t border-sky-200/80 dark:border-sky-800/80 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-sky-900 dark:text-sky-200">Topups Since Assignment:</span>
                            <span className="text-[10px] bg-sky-200/80 dark:bg-sky-800 text-sky-900 dark:text-sky-100 px-2 py-0.5 rounded font-bold">
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
                </div>

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

                  {/* Top inputs: Customer Paid + Dollar Rate + Customer Will Pay (BDT) + Payment Channel + Paid (BDT) + Topup Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">TOPUP AMOUNT (USD)</label>
                      <div className="relative">
                        <input
                          id="checkout-amount-usd"
                          type="number"
                          required
                          min={1}
                          className="w-full text-xs pl-8 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                          value={topupAmountUSD || ''}
                          onChange={(e) => setTopupAmountUSD(Number(e.target.value))}
                        />
                        <span className="absolute left-3 top-3 text-slate-400 text-xs font-bold">$</span>
                      </div>
                    </div>
                    <div>
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
                    </div>
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
                      <span className="text-[10px] text-slate-400 mt-1 block">Auto-calculated: USD x Dollar Rate</span>
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
                          value={paidBDT || ''}
                          onChange={(e) => setPaidBDT(Number(e.target.value))}
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

                    {/* Topup Status — sits directly under Payment Channel */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Topup Status</label>
                      <select
                        id="checkout-topup-status"
                        className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                        value={topupStatus}
                        onChange={(e) => setTopupStatus(e.target.value)}
                      >
                        <option value="Successfull">Successful</option>
                        <option value="Pending">Pending Sync</option>
                        <option value="Failed">Failed / Declined</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Screenshot — full width below the main grid */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                      Payment Screenshot {hasPaidAmount ? <span className="text-rose-500">*</span> : <span className="normal-case font-semibold text-[10px] text-slate-400">(optional when no amount is paid)</span>}
                    </label>
                    {paymentScreenshot ? (
                      <div className="relative w-full border border-emerald-200 dark:border-emerald-800/60 rounded-xl overflow-hidden bg-emerald-50/40 dark:bg-emerald-950/20 p-2">
                        <div className="flex items-center gap-2.5">
                          <div className="h-14 w-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0 bg-white">
                            <img
                              src={paymentScreenshot}
                              alt="Payment Screenshot"
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle size={12} /> Screenshot Attached
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={screenshotName}>
                              {screenshotName}
                            </p>
                            <button
                              type="button"
                              onClick={handleRemoveScreenshot}
                              className="mt-1 text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                            >
                              <XIcon size={10} /> Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="checkout-payment-screenshot"
                        className="w-full flex flex-col items-center justify-center gap-1.5 px-3 py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-brand-blue hover:bg-blue-50/40 dark:hover:bg-slate-800/40 rounded-xl cursor-pointer transition-colors text-center"
                      >
                        <Upload size={18} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Click to upload screenshot
                        </span>
                        <span className="text-[10px] text-slate-400">
                          PNG, JPG, JPEG, WebP, GIF (max 5 MB)
                        </span>
                        <input
                          id="checkout-payment-screenshot"
                          type="file"
                          accept="image/*"
                          onChange={handleScreenshotUpload}
                          className="hidden"
                        />
                      </label>
                    )}
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
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Target Ad Account</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{activeAccount?.adAccountName || 'N/A'}</p>
                      <p className="text-xs font-mono font-medium text-brand-blue-deep/70 dark:text-brand-blue-deep/70 mt-0.5">ID: {activeAccount?.adAccountId}</p>
                    </div>
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Billing BM Hub</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{activeAccount?.bmName || 'AdsBuzz Partner'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs pt-4 border-t border-border-blue dark:border-border-blue text-center">
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
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-border-blue dark:border-border-blue">
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">BDT Amount Paid</p>
                      <p className="font-black text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">৳{paidBDT.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Remaining Due</p>
                      <p className={`font-black text-sm mt-0.5 ${dueBDT > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                        ৳{dueBDT.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs pt-4 border-t border-border-blue dark:border-border-blue items-center">
                    <div>
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold">Payment Channel</p>
                      <p className="font-extrabold text-sm text-brand-blue-deep dark:text-brand-blue-deep mt-0.5">{paymentMethod}</p>
                    </div>
                    <div>
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
                    </div>
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

                  {paymentScreenshot && (
                    <div className="pt-4 border-t border-border-blue dark:border-border-blue">
                      <p className="text-brand-blue-deep/75 dark:text-brand-blue-deep/75 font-semibold text-xs mb-2">Payment Screenshot</p>
                      <div className="bg-surface dark:bg-surface p-2.5 rounded-xl border border-border-blue-light dark:border-border-blue-light inline-flex items-center gap-3 shadow-xs">
                        <div className="h-16 w-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex-shrink-0">
                          <img
                            src={paymentScreenshot}
                            alt="Payment Screenshot"
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="text-xs">
                          <p className="font-extrabold text-brand-blue-deep dark:text-brand-blue-deep">{screenshotName || 'Attached'}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Proof of payment on file</p>
                        </div>
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
                <span className="font-semibold text-slate-700 dark:text-slate-300">${topupAmountUSD.toFixed(1)}</span>
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
                <span className="font-semibold text-emerald-600">৳{paidBDT.toLocaleString()}</span>
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
              {invoices.length}
            </span>
            Total Entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/20 font-bold border-b border-slate-100 dark:border-slate-800 text-slate-500">
              <tr>
                <th scope="col" className="py-3.5 pl-4">Group Code</th>
                <th scope="col" className="py-3.5">Customer Name</th>
                <th scope="col" className="py-3.5">Ad Account Name</th>
                <th scope="col" className="py-3.5 text-right">Topup Amount (USD)</th>
                <th scope="col" className="py-3.5 text-center">Platform</th>
                <th scope="col" className="py-3.5 text-center">Status</th>
                <th scope="col" className="py-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedInvoices.map((inv) => {
                const custName = customers.find(c => c.id === inv.customerId)?.name || "Cash Client";
                const displayGroupCode = inv.groupId || inv.invoiceNo;
                const recordStatus = inv.status || inv.paymentStatus;
                return (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-4 font-bold text-slate-800 dark:text-slate-200 font-mono">{displayGroupCode}</td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-white">{custName}</td>
                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{inv.adAccountName}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">${inv.topupAmountUSD}</td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs">
                        <PlatformText platform={inv.platform} variant="badge" />
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block ${
                        recordStatus === 'Active' || recordStatus === 'Paid' || recordStatus === 'Available' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        recordStatus === 'Need Support' || recordStatus === 'Partially Paid' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                        'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {recordStatus}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingInvoice({ ...inv });
                          setEditForm({ ...inv });
                          setShowEditInvoiceModal(true);
                        }}
                        leftIcon={<FileEdit size={11} />}
                        className="ml-auto"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Showing {paginatedInvoices.length} of {invoices.length} entries
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={clampedPage === 1}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight size={12} className="rotate-180" />
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 w-7 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    page === clampedPage
                      ? 'bg-brand-blue text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={clampedPage === totalPages}
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Next
                <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

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

    </div>
  );
}

export default memo(SalesView);

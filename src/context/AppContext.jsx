'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  INITIAL_SETTINGS,
  INITIAL_SERIES,
  INITIAL_CARDS,
  INITIAL_CUSTOMERS,
  INITIAL_INVOICES,
  INITIAL_VENDORS,
  INITIAL_SETUPS,
  INITIAL_ACTIVITIES,
} from '@/data/seedData';
import { useCustomers } from '@/hooks/useCustomers';
import { useAdAccounts } from '@/hooks/useAdAccounts';
import { useInvoices } from '@/hooks/useInvoices';
import { useCards } from '@/hooks/useCards';
import { useVendors } from '@/hooks/useVendors';
import { useSeries } from '@/hooks/useSeries';
import { useSaleSetups } from '@/hooks/useSaleSetups';
import { useSettings } from '@/hooks/useSettings';
import { useActivities } from '@/hooks/useActivities';
import { uploadScreenshot, getErrorMessage } from '@/utils/api';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [selectedInsightsAccountId, setSelectedInsightsAccountId] = useState('');

  // Cross-view "auto-open" intent flags
  const [pendingOpenAddCustomer, setPendingOpenAddCustomer] = useState(false);
  const [pendingOpenAddAccount, setPendingOpenAddAccount] = useState(false);
  const [pendingInitialCheckoutStep, setPendingInitialCheckoutStep] = useState(null);
  const [pendingInitialCustomerId, setPendingInitialCustomerId] = useState(null);
  const [pendingInitialSalesCustomerId, setPendingInitialSalesCustomerId] = useState(null);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerToast = useCallback((type, title, description) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    triggerToast('success', 'Theme Updated', `Toggled to ${!darkMode ? 'Dark' : 'Light'} Mode`);
  };

  const {
    customers,
    loading: customersLoading,
    error: customersError,
    addCustomer,
    updateCustomer: rawUpdateCustomer,
    updateCustomerNotes: rawUpdateCustomerNotes,
    toggleFavorite: rawToggleFavorite,
    applySaleCredit,
    refetch: refetchCustomers,
  } = useCustomers(triggerToast);

  const {
    adAccounts,
    loading: adAccountsLoading,
    error: adAccountsError,
    addAdAccount,
    updateAdAccount: rawUpdateAdAccount,
    updateAccountStatus: rawUpdateAccountStatus,
    bulkUpdateStatus: rawBulkUpdateStatus,
    markAccountSold,
    refetch: refetchAdAccounts,
  } = useAdAccounts(triggerToast);

  const {
    invoices,
    error: invoicesError,
    addInvoice,
    updateInvoice: rawUpdateInvoice,
    approveInvoice: rawApproveInvoice,
    rejectInvoice: rawRejectInvoice,
    syncTopupStatus: rawSyncTopupStatus,
    refetch: refetchInvoices,
  } = useInvoices(triggerToast);

  const {
    cards,
    error: cardsError,
    addCard,
    updateCard: rawUpdateCard,
    toggleCardStatus: rawToggleCardStatus,
    applyCardLoad,
    refetch: refetchCards,
  } = useCards(triggerToast);
  const {
    vendors,
    error: vendorsError,
    addVendor,
    updateVendor: rawUpdateVendor,
    payVendor: rawPayVendor,
    refetch: refetchVendors,
  } = useVendors(triggerToast);
  const {
    series,
    error: seriesError,
    addSeries,
    updateSeries: rawUpdateSeries,
    refetch: refetchSeries,
  } = useSeries(triggerToast);
  const {
    setups,
    error: setupsError,
    addSetup,
    updateSaleSetup: rawUpdateSaleSetup,
    refetch: refetchSetups,
  } = useSaleSetups(triggerToast);
  const {
    settings,
    error: settingsError,
    updateBaseRate: rawUpdateBaseRate,
    addPaymentMethod: rawAddPaymentMethod,
    deletePaymentMethod: rawDeletePaymentMethod,
    refetch: refetchSettings,
  } = useSettings(triggerToast);
  const { activities, error: activitiesError, addActivity, refetch: refetchActivities } = useActivities();

  const logActivityFx = (user, action, details, type) => {
    addActivity({ time: "Just now", user, action, details, type });
  };

  // Wrapped mutation handlers so every action also writes to the activity feed
  const wrapCustomerUpdate = (result, name, type) => {
    if (result) logActivityFx("Rakibul Riyet", name, `${result.name || ""} (${result.id || ""})`.trim(), type);
    return result;
  };

  const handleApproveInvoice = async (invoiceNo) => {
    const result = await rawApproveInvoice(invoiceNo);
    logActivityFx("Finance Auditor", "Approved Invoice", `Invoice ${invoiceNo} approved and settled.`, "payment");
    return result;
  };

  const handleRejectInvoice = async (invoiceNo) => {
    const result = await rawRejectInvoice(invoiceNo);
    logActivityFx("Finance Auditor", "Rejected Invoice", `Invoice ${invoiceNo} rejected.`, "payment");
    return result;
  };

  const handleSyncTopupStatus = async (invoiceNo, status) => {
    const result = await rawSyncTopupStatus(invoiceNo, status);
    logActivityFx("System Scheduler", "Topup Status Sync", `Invoice ${invoiceNo} synced (${status}).`, "system");
    return result;
  };

  const handleUpdateInvoice = async (inv) => {
    const result = await rawUpdateInvoice(inv);
    logActivityFx("Rakibul R.", "Updated Invoice", `Invoice ${inv?.invoiceNo} edited.`, "payment");
    return result;
  };

  const handleUpdateCustomer = async (cust) => {
    const result = await rawUpdateCustomer(cust);
    wrapCustomerUpdate(result, "Updated Customer", "customer");
    return result;
  };

  const handleUpdateCustomerNotes = async (id, notes) => {
    const result = await rawUpdateCustomerNotes(id, notes);
    if (result) logActivityFx("Rakibul R.", "Updated CRM Notes", `Customer ${result.id} notes updated.`, "customer");
    return result;
  };

  const handleToggleFavorite = async (id) => {
    const result = await rawToggleFavorite(id);
    if (result) logActivityFx("Rakibul R.", "Toggled Favorite", `Customer ${result.id} favorite toggled.`, "customer");
    return result;
  };

  const handleUpdateAdAccount = async (acc) => {
    const result = await rawUpdateAdAccount(acc);
    if (result) logActivityFx("Rakibul R.", "Updated Ad Account", `Ad account ${result.adAccountName} updated.`, "account");
    return result;
  };

  const handleUpdateAccountStatus = async (id, status) => {
    const result = await rawUpdateAccountStatus(id, status);
    if (result) logActivityFx("Rakibul R.", "Updated Account Status", `Ad account ${result.adAccountId} set to ${status}.`, "account");
    return result;
  };

  const handleBulkUpdateStatus = async (ids, status) => {
    const result = await rawBulkUpdateStatus(ids, status);
    if (result) logActivityFx("Rakibul R.", "Bulk Status Update", `${ids?.length || 0} accounts set to ${status}.`, "account");
    return result;
  };

  const updateCard = async (card) => {
    const result = await rawUpdateCard(card);
    if (result) logActivityFx("Rakibul R.", "Updated Card", `Card ${result.cardName} updated.`, "system");
    return result;
  };

  const handleToggleCardStatus = async (id) => {
    const result = await rawToggleCardStatus(id);
    if (result) logActivityFx("Rakibul R.", "Toggled Card Status", `Card ${result.cardName} set to ${result.status}.`, "system");
    return result;
  };

  const handleUpdateVendor = async (vendor) => {
    const result = await rawUpdateVendor(vendor);
    if (result) logActivityFx("Rakibul R.", "Updated Vendor", `Vendor ${result.name} updated.`, "system");
    return result;
  };

  const handlePayVendor = async (id, payload) => {
    const result = await rawPayVendor(id, payload);
    if (result) logActivityFx("Finance Auditor", "Vendor Payment", `Payment of $${payload?.amountUSD} recorded for ${result.name}.`, "payment");
    return result;
  };

  const handleUpdateSeries = async (series) => {
    const result = await rawUpdateSeries(series);
    if (result) logActivityFx("Rakibul R.", "Updated Series", `Series ${result.seriesName} updated.`, "system");
    return result;
  };

  const handleUpdateSaleSetup = async (setup) => {
    const result = await rawUpdateSaleSetup(setup);
    if (result) logActivityFx("Rakibul R.", "Updated Sale Setup", `Setup for ${result.adName} updated.`, "account");
    return result;
  };

  const handleUpdateBaseRate = async (rate) => {
    const result = await rawUpdateBaseRate(rate);
    if (result) logActivityFx("Finance Auditor", "Updated Base Rate", `Default dollar rate set to ৳${rate}.`, "payment");
    return result;
  };

  const handleAddPaymentMethod = async (method) => {
    const result = await rawAddPaymentMethod(method);
    if (result) logActivityFx("Rakibul R.", "Added Payment Method", `${method} added.`, "payment");
    return result;
  };

  const handleDeletePaymentMethod = async (method) => {
    const result = await rawDeletePaymentMethod(method);
    if (result) logActivityFx("Rakibul R.", "Removed Payment Method", `${method} removed.`, "payment");
    return result;
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'd':
            e.preventDefault();
            router.push('/');
            triggerToast('info', 'View Routed', 'Switched to Operations Dashboard');
            break;
          case 'n':
            e.preventDefault();
            router.push('/sales');
            triggerToast('info', 'View Routed', 'Switched to Shopify Checkout Entry');
            break;
          case 't':
            e.preventDefault();
            toggleTheme();
            break;
          case 'k':
            e.preventDefault();
            const searchInput = document.getElementById('global-search-input');
            if (searchInput) searchInput.focus();
            break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [darkMode]);

  // Clear pending auto-open intent flags
  useEffect(() => {
    if (pendingOpenAddCustomer) setPendingOpenAddCustomer(false);
  }, []);
  useEffect(() => {
    if (pendingOpenAddAccount) setPendingOpenAddAccount(false);
  }, []);
  useEffect(() => {
    if (pendingInitialCheckoutStep !== null || pendingInitialSalesCustomerId !== null) {
      setPendingInitialCheckoutStep(null);
      setPendingInitialSalesCustomerId(null);
    }
  }, []);
  useEffect(() => {
    if (pendingInitialCustomerId !== null) setPendingInitialCustomerId(null);
  }, []);

  const handleAddCustomer = (customerData) => {
    const newCustomer = addCustomer(customerData);
    addActivity({
      id: `act-${Date.now()}`,
      time: "Just now",
      user: "Rakibul Riyet",
      action: "Onboarded Customer",
      details: `Created profile for ${customerData.name} (${customerData.companyName})`,
      type: 'customer',
    });
    return newCustomer;
  };

  const handleAddAdAccount = (accountData) => {
    addAdAccount(accountData);
    addActivity({
      id: `act-${Date.now()}`,
      time: "Just now",
      user: "Rakibul R.",
      action: "Cataloged Ad Account",
      details: `Loaded ${accountData.adAccountName} (${accountData.platform}) to unassigned pool.`,
      type: 'account',
    });
  };

  const handleExecuteSale = async (saleData) => {
    let newInvoice;
    try {
      const payload = { ...saleData };

      // Persist the payment screenshot to the upload store instead of embedding
      // the full data URL in the invoice document.
      if (typeof payload.paymentScreenshot === 'string' && payload.paymentScreenshot.startsWith('data:')) {
        try {
          const uploadedUrl = await uploadScreenshot({
            name: payload.screenshotName || 'payment-screenshot.png',
            data: payload.paymentScreenshot,
          });
          if (uploadedUrl) {
            payload.paymentScreenshot = uploadedUrl;
            payload.screenshotName = payload.screenshotName || 'payment-screenshot.png';
          }
        } catch (uploadErr) {
          triggerToast('error', 'Screenshot Upload Failed', uploadErr.message);
          // Continue the sale with the data URL embedded so the transaction is not lost.
        }
      }

      newInvoice = await addInvoice(payload);
    } catch (err) {
      triggerToast('error', 'Sale Failed', getErrorMessage(err));
      return;
    }

    const invoiceNo = newInvoice.invoiceNo || 'INV';
    const paidAmountBDT = newInvoice.paidAmountBDT || saleData.paidAmountBDT || 0;

    addActivity({
      id: `act-${Date.now()}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      user: "Rakibul Riyet",
      action: "Completed Topup",
      details: `${invoiceNo} - Loaded $${(saleData.topupAmountUSD || 0).toFixed(1)} to ${saleData.adAccountName}`,
      type: 'sale',
    });

    triggerToast(
      'success',
      'Sale Executed Successfully',
      `Invoice ${invoiceNo} generated. ৳${Number(paidAmountBDT).toLocaleString()} settled.`,
    );
    router.push('/');
  };

  const handleTriggerExport = async (format) => {
    const fmt = format === 'excel' ? 'xlsx' : format;
    const url = `/api/reports/export?format=${encodeURIComponent(fmt)}`;

    triggerToast(
      'info',
      'Generating document export...',
      `Processing ledger rows into standard AdsBuzz ${fmt.toUpperCase()} layout.`,
    );

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match?.[1] || `AdsBuzz_Ledger_Statements.${fmt}`;

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      triggerToast('success', 'Download Complete', filename);
    } catch (err) {
      triggerToast('error', 'Export Failed', err.message);
    }
  };

  const handleSelectCustomerFromHeader = (id) => {
    setPendingInitialCustomerId(id);
    router.push('/customers?customerId=' + id);
  };

  const handleSelectAdAccountFromHeader = () => {
    router.push('/ad-accounts');
  };

  const handleNavigate = (view) => {
    const path = view === 'dashboard' ? '/' : `/${view}`;
    router.push(path);
  };

  const handleQuickAction = (actionType) => {
    if (actionType === 'new-sale') {
      router.push('/sales');
    } else if (actionType === 'new-customer') {
      setPendingOpenAddCustomer(true);
      router.push('/customers?autoOpenAdd=true');
    } else if (actionType === 'new-topup') {
      setPendingInitialCheckoutStep(2);
      router.push('/sales?step=2');
    } else if (actionType === 'assign-account') {
      setPendingOpenAddAccount(true);
      router.push('/ad-accounts?autoOpenAdd=true');
    }
  };

  const handleTriggerTopup = (custId) => {
    setPendingInitialSalesCustomerId(custId);
    router.push(`/sales?customerId=${custId}`);
    triggerToast('info', 'Customer Selected', 'Initiating Shopify Checkout sequence');
  };

  const handleTriggerAssign = () => {
    setPendingOpenAddAccount(true);
    router.push('/ad-accounts?autoOpenAdd=true');
  };

  const handleNavigateToCustomers = () => {
    setPendingOpenAddCustomer(true);
    router.push('/customers?autoOpenAdd=true');
  };

  const computeDashboardStats = () => {
    const today = "2026-06-01";
    const todayInvoices = invoices.filter(inv => inv.date === today && inv.paymentStatus === 'Paid');
    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.topupAmountUSD, 0);

    const monthlySales = invoices
      .filter(inv => inv.paymentStatus === 'Paid')
      .reduce((sum, inv) => sum + inv.topupAmountUSD, 0);

    const pendingTopups = invoices.filter(inv => inv.topupStatus === 'Pending').length;
    const pendingApprovals = invoices.filter(inv => inv.approvalStatus === 'Pending').length;
    const activeCustomers = customers.filter(c => c.status === 'Active').length;
    const activeAccounts = adAccounts.filter(acc => acc.accountStatus === 'Active').length;
    const assignedAccounts = adAccounts.filter(acc => !!acc.assignedCustomer).length;
    const vendorDue = vendors.reduce((sum, v) => sum + v.outstandingBalanceUSD, 0);

    return {
      todaySales,
      monthlySales,
      pendingTopups,
      pendingApprovals,
      activeCustomers,
      activeAccounts,
      assignedAccounts,
      vendorDue
    };
  };

  const stats = useMemo(computeDashboardStats, [invoices, adAccounts, customers, vendors]);

  const value = {
    darkMode,
    searchQuery,
    setSearchQuery,
    toasts,
    removeToast,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    selectedInsightsAccountId,
    setSelectedInsightsAccountId,
    pendingOpenAddCustomer,
    pendingOpenAddAccount,
    pendingInitialCheckoutStep,
    pendingInitialCustomerId,
    pendingInitialSalesCustomerId,

    customers,
    customersLoading,
    customersError,
    adAccounts,
    adAccountsLoading,
    adAccountsError,
    invoices,
    invoicesError,
    cards,
    cardsError,
    vendors,
    vendorsError,
    series,
    seriesError,
    setups,
    setupsError,
    settings,
    settingsError,
    activities,
    activitiesError,
    stats,

    refetchCustomers,
    refetchAdAccounts,
    refetchInvoices,
    refetchCards,
    refetchVendors,
    refetchSeries,
    refetchSetups,
    refetchSettings,
    refetchActivities,

    toggleTheme,
    triggerToast,
    handleAddCustomer,
    handleUpdateCustomer,
    handleUpdateCustomerNotes,
    handleToggleFavorite,
    handleAddAdAccount,
    handleUpdateAdAccount,
    handleUpdateAccountStatus,
    handleBulkUpdateStatus,
    handleExecuteSale,
    handleUpdateInvoice,
    handleApproveInvoice,
    handleRejectInvoice,
    handleSyncTopupStatus,
    updateCard,
    handleToggleCardStatus,
    addCard,
    handleUpdateVendor,
    addVendor,
    handlePayVendor,
    handleUpdateSeries,
    addSeries,
    handleUpdateSaleSetup,
    addSetup,
    handleUpdateBaseRate,
    handleAddPaymentMethod,
    handleDeletePaymentMethod,
    handleTriggerExport,
    handleSelectCustomerFromHeader,
    handleSelectAdAccountFromHeader,
    applyCardLoad,
    markAccountSold,
    applySaleCredit,
    handleNavigate,
    handleQuickAction,
    handleTriggerTopup,
    handleTriggerAssign,
    handleNavigateToCustomers,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
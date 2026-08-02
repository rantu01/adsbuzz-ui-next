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
    addCustomer,
    updateCustomer: handleUpdateCustomer,
    updateCustomerNotes: handleUpdateCustomerNotes,
    toggleFavorite: handleToggleFavorite,
    applySaleCredit,
  } = useCustomers(triggerToast);

  const {
    adAccounts,
    addAdAccount,
    updateAdAccount: handleUpdateAdAccount,
    updateAccountStatus: handleUpdateAccountStatus,
    bulkUpdateStatus: handleBulkUpdateStatus,
    markAccountSold,
  } = useAdAccounts(triggerToast);

  const {
    invoices,
    addInvoice,
    updateInvoice: handleUpdateInvoice,
    approveInvoice: handleApproveInvoice,
    rejectInvoice: handleRejectInvoice,
    syncTopupStatus: handleSyncTopupStatus,
  } = useInvoices(triggerToast);

  const { cards, addCard, updateCard, toggleCardStatus: handleToggleCardStatus, applyCardLoad } = useCards(triggerToast);
  const { vendors, addVendor, updateVendor: handleUpdateVendor } = useVendors(triggerToast);
  const { series, addSeries, updateSeries: handleUpdateSeries } = useSeries(triggerToast);
  const { setups, addSetup, updateSaleSetup: handleUpdateSaleSetup } = useSaleSetups(triggerToast);
  const {
    settings,
    updateBaseRate: handleUpdateBaseRate,
    addPaymentMethod: handleAddPaymentMethod,
    deletePaymentMethod: handleDeletePaymentMethod,
  } = useSettings(triggerToast);
  const { activities, addActivity } = useActivities();

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

  const handleExecuteSale = (saleData) => {
    const serial = invoices.length + 1;
    const invoiceNo = `ADB 202416${serial.toString().padStart(3, '0')}`;
    const today = new Date().toISOString().split('T')[0];

    const newInvoice = {
      ...saleData,
      invoiceNo,
      date: today,
    };

    addInvoice(newInvoice);

    if (saleData.adAccountId && saleData.customerId) {
      markAccountSold(saleData.adAccountId, saleData.customerId);
    }

    if (saleData.customerId) {
      applySaleCredit(saleData.customerId, saleData.paidAmountBDT, saleData.topupAmountUSD);
    }

    const targetAccount = adAccounts.find(acc => acc.adAccountId === saleData.adAccountId);
    if (targetAccount?.billingCard) {
      applyCardLoad(targetAccount.billingCard, saleData.topupAmountUSD);
    }

    addActivity({
      id: `act-${Date.now()}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      user: "Rakibul Riyet",
      action: "Completed Topup",
      details: `${invoiceNo} - Loaded $${saleData.topupAmountUSD.toFixed(1)} to ${saleData.adAccountName}`,
      type: 'sale',
    });

    triggerToast(
      'success',
      'Sale Executed Successfully',
      `Invoice ${invoiceNo} generated. ৳${saleData.paidAmountBDT.toLocaleString()} settled.`,
    );
    router.push('/');
  };

  const handleTriggerExport = (format) => {
    triggerToast(
      'info',
      'Generating Document export...',
      `Processing ledger rows into standard AdsBuzz ${format.toUpperCase()} layout.`,
    );
    setTimeout(() => {
      triggerToast(
        'success',
        'Download Complete',
        `AdsBuzz_Ledger_Statements_June2026.${format === 'excel' ? 'xlsx' : format}`,
      );
    }, 1500);
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
    adAccounts,
    invoices,
    cards,
    vendors,
    series,
    setups,
    settings,
    activities,
    stats,

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
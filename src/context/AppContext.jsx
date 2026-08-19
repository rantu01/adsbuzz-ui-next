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
import { usePlatforms } from '@/hooks/usePlatforms';
import { useWallets } from '@/hooks/useWallets';
import { useSocialAdAccounts } from '@/hooks/useSocialAdAccounts';
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
  const [pendingSetupPrefill, setPendingSetupPrefill] = useState(null);

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
    deleteCustomer: rawDeleteCustomer,
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
    deleteAdAccount: rawDeleteAdAccount,
    updateAccountStatus: rawUpdateAccountStatus,
    bulkUpdateStatus: rawBulkUpdateStatus,
    markAccountSold,
    assignAdAccount: rawAssignAdAccount,
    unassignAdAccount: rawUnassignAdAccount,
    refetch: refetchAdAccounts,
  } = useAdAccounts(triggerToast);

  const {
    socialAdAccounts,
    loading: socialAdAccountsLoading,
    error: socialAdAccountsError,
    addSocialAdAccount,
    updateSocialAdAccount: rawUpdateSocialAdAccount,
    deleteSocialAdAccount: rawDeleteSocialAdAccount,
    assignSocialAdAccount: rawAssignSocialAdAccount,
    unassignSocialAdAccount: rawUnassignSocialAdAccount,
    refetch: refetchSocialAdAccounts,
  } = useSocialAdAccounts(triggerToast);

  const {
    invoices,
    error: invoicesError,
    addInvoice,
    addHistoricalInvoice,
    updateInvoice: rawUpdateInvoice,
    approveInvoice: rawApproveInvoice,
    rejectInvoice: rawRejectInvoice,
    syncTopupStatus: rawSyncTopupStatus,
    recordPayment: rawRecordPayment,
    refetch: refetchInvoices,
  } = useInvoices(triggerToast);

  const {
    cards,
    error: cardsError,
    addCard,
    updateCard: rawUpdateCard,
    toggleCardStatus: rawToggleCardStatus,
    deleteCard: rawDeleteCard,
    applyCardLoad,
    refetch: refetchCards,
  } = useCards(triggerToast);
  const {
    vendors,
    error: vendorsError,
    addVendor,
    updateVendor: rawUpdateVendor,
    payVendor: rawPayVendor,
    deleteVendor: rawDeleteVendor,
    refetch: refetchVendors,
  } = useVendors(triggerToast);
  const {
    series,
    error: seriesError,
    addSeries,
    updateSeries: rawUpdateSeries,
    deleteSeries: rawDeleteSeries,
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
  const {
    platforms,
    loading: platformsLoading,
    error: platformsError,
    addPlatform: rawAddPlatform,
    updatePlatform: rawUpdatePlatform,
    togglePlatformStatus: rawTogglePlatformStatus,
    deletePlatform: rawDeletePlatform,
    refetch: refetchPlatforms,
  } = usePlatforms(triggerToast);
  const {
    wallets,
    loading: walletsLoading,
    error: walletsError,
    addWallet: rawAddWallet,
    updateWallet: rawUpdateWallet,
    deleteWallet: rawDeleteWallet,
    refetch: refetchWallets,
  } = useWallets(triggerToast);

  const logActivityFx = (user, action, details, type, customerId) => {
    addActivity({ time: "Just now", user, action, details, type, ...(customerId && { customerId }) });
  };

  // Wrapped mutation handlers so every action also writes to the activity feed
  const wrapCustomerUpdate = (result, name, type) => {
    if (result) logActivityFx("Rakibul R.", name, `${result.name || ""} (${result.id || ""})`.trim(), type, result.id);
    return result;
  };

  const handleApproveInvoice = async (invoiceNo) => {
    const result = await rawApproveInvoice(invoiceNo);
    const customerId = result?.customerId || "";
    logActivityFx("Finance Auditor", "Approved Invoice", `Invoice ${invoiceNo} approved and settled.`, "payment", customerId);
    return result;
  };

  const handleRejectInvoice = async (invoiceNo) => {
    const result = await rawRejectInvoice(invoiceNo);
    const customerId = result?.customerId || "";
    logActivityFx("Finance Auditor", "Rejected Invoice", `Invoice ${invoiceNo} rejected.`, "payment", customerId);
    return result;
  };

  const handleSyncTopupStatus = async (invoiceNo, status) => {
    const result = await rawSyncTopupStatus(invoiceNo, status);
    const customerId = result?.customerId || "";
    logActivityFx("System Scheduler", "Topup Status Sync", `Invoice ${invoiceNo} synced (${status}).`, "system", customerId);
    return result;
  };

  const handleUpdateInvoice = async (inv) => {
    const result = await rawUpdateInvoice(inv);
    logActivityFx("Rakibul R.", "Updated Invoice", `Invoice ${inv?.invoiceNo} edited.`, "payment", inv?.customerId);
    return result;
  };

  const handleRecordInvoicePayment = async (invoiceNo, payload) => {
    const result = await rawRecordPayment(invoiceNo, payload);
    const amountBDT = Number(payload?.amountBDT || 0);
    logActivityFx(
      "Rakibul R.",
      "Invoice Payment Received",
      `Invoice ${invoiceNo} — ৳${amountBDT.toLocaleString()} payment recorded. Balance now ${result?.paymentStatus || ""}.`,
      "payment",
      result?.customerId || payload?.customerId,
    );
    return result;
  };

  const handleUpdateCustomer = async (cust) => {
    const result = await rawUpdateCustomer(cust);
    wrapCustomerUpdate(result, "Updated Customer", "customer", cust.id);
    return result;
  };

  const handleUpdateCustomerNotes = async (id, notes) => {
    const result = await rawUpdateCustomerNotes(id, notes);
    if (result) logActivityFx("Rakibul R.", "Updated CRM Notes", `Customer ${result.id} notes updated.`, "customer", result.id);
    return result;
  };

  const handleToggleFavorite = async (id) => {
    const result = await rawToggleFavorite(id);
    if (result) logActivityFx("Rakibul R.", "Toggled Favorite", `Customer ${result.id} favorite toggled.`, "customer", result.id);
    return result;
  };

  const handleDeleteCustomer = async (id) => {
    const result = await rawDeleteCustomer(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Customer", `${result.name} (${result.id}) removed from CRM.`, "customer", result.id);
    return result;
  };

  const handleUpdateAdAccount = async (acc) => {
    const result = await rawUpdateAdAccount(acc);
    if (result) logActivityFx("Rakibul R.", "Updated Ad Account", `Ad account ${result.adAccountName} updated.`, "account");
    return result;
  };

  const handleDeleteAdAccount = async (id) => {
    const result = await rawDeleteAdAccount(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Ad Account", `Ad account ${result.adAccountName} removed from inventory.`, "account");
    return result;
  };

  const handleAssignAdAccount = async (adAccountId, customerId) => {
    const result = await rawAssignAdAccount(adAccountId, customerId);
    if (result) logActivityFx("Rakibul R.", "Assigned Ad Account", `${result.adAccountName} assigned to customer ${customerId}.`, "account", customerId);
    return result;
  };

  const handleUnassignAdAccount = async (adAccountId, reason) => {
    const result = await rawUnassignAdAccount(adAccountId, reason);
    if (result) {
      const reasonText = reason ? ` Reason: ${reason}.` : "";
      logActivityFx(
        "Rakibul R.",
        "Unassigned Ad Account",
        `${result.adAccountName} unassigned and returned to available pool.${reasonText}`,
        "account",
        result.previousCustomerId || "",
      );
    }
    return result;
  };

  const handleAssignSocialAdAccount = async (adAccountId, customerId) => {
    const result = await rawAssignSocialAdAccount(adAccountId, customerId);
    if (result) logActivityFx("Rakibul R.", "Assigned Social Ad Account", `${result.adAccountName} assigned to customer ${customerId}.`, "account", customerId);
    return result;
  };

  const handleUnassignSocialAdAccount = async (adAccountId, reason) => {
    const result = await rawUnassignSocialAdAccount(adAccountId, reason);
    if (result) {
      const reasonText = reason ? ` Reason: ${reason}.` : "";
      logActivityFx(
        "Rakibul R.",
        "Unassigned Social Ad Account",
        `${result.adAccountName} unassigned and returned to available pool.${reasonText}`,
        "account",
        result.previousCustomerId || "",
      );
    }
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

  const handleDeleteCard = async (id) => {
    const result = await rawDeleteCard(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Card", `Card ${result.cardName} removed.`, "system");
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

  const handleDeleteVendor = async (id) => {
    const result = await rawDeleteVendor(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Vendor", `${result.name} (${result.id}) removed from vendor roster.`, "system");
    return result;
  };

  const handleUpdateSeries = async (series) => {
    const result = await rawUpdateSeries(series);
    if (result) logActivityFx("Rakibul R.", "Updated Series", `Series ${result.seriesName} updated.`, "system");
    return result;
  };

  const handleDeleteSeries = async (seriesId) => {
    const result = await rawDeleteSeries(seriesId);
    if (result) logActivityFx("Rakibul R.", "Deleted Series", `${result.seriesName} (${result.seriesId}) removed from registry.`, "system");
    return result;
  };

  const handleAddPlatform = async (platformData) => {
    const result = await rawAddPlatform(platformData);
    if (result) logActivityFx("Rakibul R.", "Added Platform", `${result.platformName} (${result.platformId}) added to platform registry.`, "system");
    return result;
  };

  const handleUpdatePlatform = async (platform) => {
    const result = await rawUpdatePlatform(platform);
    if (result) logActivityFx("Rakibul R.", "Updated Platform", `Platform ${result.platformName} updated.`, "system");
    return result;
  };

  const handleTogglePlatformStatus = async (id) => {
    const result = await rawTogglePlatformStatus(id);
    if (result) logActivityFx("Rakibul R.", "Toggled Platform Status", `Platform ${result.platformName} set to ${result.status}.`, "system");
    return result;
  };

  const handleDeletePlatform = async (id) => {
    const result = await rawDeletePlatform(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Platform", `Platform ${result.platformName} removed.`, "system");
    return result;
  };

  const handleAddWallet = async (walletData) => {
    const result = await rawAddWallet(walletData);
    if (result) logActivityFx("Rakibul R.", "Added Wallet", `${result.ownerName} (${result.walletId}) added to wallet registry.`, "system");
    return result;
  };

  const handleUpdateWallet = async (wallet) => {
    const result = await rawUpdateWallet(wallet);
    if (result) logActivityFx("Rakibul R.", "Updated Wallet", `Wallet ${result.ownerName} updated.`, "system");
    return result;
  };

  const handleDeleteWallet = async (id) => {
    const result = await rawDeleteWallet(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Wallet", `Wallet ${result.ownerName} removed.`, "system");
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
  useEffect(() => {
    if (pendingSetupPrefill !== null) setPendingSetupPrefill(null);
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
      customerId: newCustomer?.id || "",
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

  const handleAddSocialAdAccount = (accountData) => {
    addSocialAdAccount(accountData);
    addActivity({
      id: `act-${Date.now()}`,
      time: "Just now",
      user: "Rakibul R.",
      action: "Loaded Social Ad Account",
      details: `Cataloged ${accountData.adAccountName} (${accountData.platform}) to Load Social Ad Account entries.`,
      type: 'account',
    });
  };

  const handleUpdateSocialAdAccount = async (acc) => {
    const result = await rawUpdateSocialAdAccount(acc);
    if (result) logActivityFx("Rakibul R.", "Updated Social Ad Account", `Social ad account ${result.adAccountName} updated.`, "account");
    return result;
  };

  const handleDeleteSocialAdAccount = async (id) => {
    const result = await rawDeleteSocialAdAccount(id);
    if (result) logActivityFx("Rakibul R.", "Deleted Social Ad Account", `Social ad account ${result.adAccountName} removed.`, "account");
    return result;
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
      customerId: saleData.customerId || "",
    });

    triggerToast(
      'success',
      'Sale Executed Successfully',
      `Invoice ${invoiceNo} generated. ৳${Number(paidAmountBDT).toLocaleString()} settled.`,
    );
    router.push('/');
  };

  const handleAddHistoricalSale = async (saleData) => {
    let invoice;
    try {
      invoice = await addHistoricalInvoice(saleData);
    } catch (err) {
      return;
    }

    const invoiceNo = invoice.invoiceNo || 'INV';
    const paidAmountBDT = invoice.paidAmountBDT || saleData.paidAmountBDT || 0;

    addActivity({
      id: `act-${Date.now()}`,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      user: "Rakibul Riyet",
      action: "Completed Historical Topup",
      details: `${invoiceNo} - Backfilled $${(saleData.topupAmountUSD || 0).toFixed(1)} for ${saleData.date} (${saleData.adAccountName})`,
      type: 'sale',
      customerId: saleData.customerId || "",
    });

    triggerToast(
      'success',
      'Historical Sale Recorded',
      `Invoice ${invoiceNo} saved for ${invoice.date}. ৳${Number(paidAmountBDT).toLocaleString()} settled.`,
    );
    return invoice;
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

  const handleConfigureSaleSetup = (customerId, adAccountId) => {
    setPendingSetupPrefill({ customerId, adAccountId });
    router.push('/sale-setup');
  };

  const clearSetupPrefill = useCallback(() => {
    setPendingSetupPrefill(null);
  }, []);

  const computeDashboardStats = () => {
    const today = "2026-06-01";
    // Historical backfilled invoices never contribute to the live dashboard
    // sales figures — they only exist as records in the sales history.
    const liveInvoices = invoices.filter(inv => inv.source !== "historical");
    const todayInvoices = liveInvoices.filter(inv => inv.date === today && inv.paymentStatus === 'Paid');
    const todaySales = todayInvoices.reduce((sum, inv) => sum + inv.topupAmountUSD, 0);

    const monthlySales = liveInvoices
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
    pendingSetupPrefill,

    customers,
    customersLoading,
    customersError,
    adAccounts,
    adAccountsLoading,
    adAccountsError,
    socialAdAccounts,
    socialAdAccountsLoading,
    socialAdAccountsError,
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
    platforms,
    platformsError,
    wallets,
    walletsError,
    stats,

    refetchCustomers,
    refetchAdAccounts,
    refetchSocialAdAccounts,
    refetchInvoices,
    refetchCards,
    refetchVendors,
    refetchSeries,
    refetchSetups,
    refetchSettings,
    refetchActivities,
    refetchPlatforms,
    refetchWallets,

    toggleTheme,
    triggerToast,
    handleAddCustomer,
    handleUpdateCustomer,
    handleUpdateCustomerNotes,
    handleToggleFavorite,
    handleDeleteCustomer,
    handleAddAdAccount,
    handleAddSocialAdAccount,
    handleUpdateAdAccount,
    handleUpdateSocialAdAccount,
    handleDeleteAdAccount,
    handleDeleteSocialAdAccount,
    handleAssignAdAccount,
    handleUnassignAdAccount,
    handleAssignSocialAdAccount,
    handleUnassignSocialAdAccount,
    handleUpdateAccountStatus,
    handleBulkUpdateStatus,
    handleExecuteSale,
    handleAddHistoricalSale,
    handleUpdateInvoice,
    handleApproveInvoice,
    handleRejectInvoice,
    handleSyncTopupStatus,
    handleRecordInvoicePayment,
    updateCard,
    handleToggleCardStatus,
    handleDeleteCard,
    addCard,
    handleUpdateVendor,
    addVendor,
    handlePayVendor,
    handleDeleteVendor,
    handleUpdateSeries,
    addSeries,
    handleDeleteSeries,
    handleAddPlatform,
    handleUpdatePlatform,
    handleTogglePlatformStatus,
    handleDeletePlatform,
    addPlatform: rawAddPlatform,
    handleAddWallet,
    handleUpdateWallet,
    handleDeleteWallet,
    addWallet: rawAddWallet,
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
    handleConfigureSaleSetup,
    clearSetupPrefill,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
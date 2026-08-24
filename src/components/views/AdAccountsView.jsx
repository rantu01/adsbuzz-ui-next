'use client';
import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  User, 
  CreditCard,
  SlidersHorizontal,
  Plus,
  RefreshCw,
  MoreVertical,
  FileEdit
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import StatCard from '@/components/common/StatCard';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FieldError from '@/components/ui/FieldError';
import { validate, hasErrors, required, maxLength } from '@/utils/formValidation';

function AdAccountsView({
  adAccounts,
  socialAdAccounts = [],
  customers,
  cards,
  series,
  onAddAdAccount,
  onAddSocialAdAccount,
  onUpdateAdAccount,
  onUpdateSocialAdAccount,
  onDeleteAdAccount,
  onDeleteSocialAdAccount,
  onAssignAdAccount,
  onUnassignAdAccount,
  onAssignSocialAdAccount,
  onUnassignSocialAdAccount,
  onUpdateAccountStatus,
  onBulkUpdateStatus,
  autoOpenAddModal = false,
  error,
  onRetry,
}) {
  const [searchTerm, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [assignmentFilter, setAssignmentFilter] = useState('All');

  // Selection state for Bulk actions
  const [selectedAccountIds, setSelectedAccountIds] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Copy to clipboard state
  const [copiedCell, setCopiedCell] = useState(null);

  const copyToClipboard = (text, cellKey) => {
    navigator.clipboard.writeText(text);
    setCopiedCell(cellKey);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  // Add Account Modal
  const [showAddModal, setShowAddModal] = useState(autoOpenAddModal);
  const [newAccountId, setNewAccountId] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newPlatform, setNewPlatform] = useState('Facebook');
  const [newAdmin, setNewAdmin] = useState('');
  const [newSeriesId, setNewSeriesId] = useState('');
  const [newBmName, setNewBmName] = useState('');
  const [newBmId, setNewBmId] = useState('');
  const [newCard, setNewCard] = useState('');
  const [newAccountStatus, setNewAccountStatus] = useState('Active');
  const [seriesFilter, setSeriesFilter] = useState('All');

  // Edit Account Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAccountData, setEditAccountData] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Assign Account Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignCustomerId, setAssignCustomerId] = useState('');
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Form validation state
  const [addFormErrors, setAddFormErrors] = useState({});
  const [addDuplicateError, setAddDuplicateError] = useState('');
  const [addDuplicateSource, setAddDuplicateSource] = useState(null);
  const [editFormErrors, setEditFormErrors] = useState({});

  useEffect(() => {
    setNewSeriesId('');
  }, [newPlatform]);

  const isProblemAccountStatus = (status) => (
    status === 'Need Support' ||
    status === 'Terminated' ||
    status === 'Restricted' ||
    status === 'Disabled' ||
    status === 'Disable'
  );

  const getEffectiveAccountStatus = (acc) => {
    if (isProblemAccountStatus(acc.accountStatus)) return acc.accountStatus;
    return acc.assignedCustomer || acc.accountStatus === 'Active' ? 'Sold' : acc.accountStatus;
  };

  // This page shows only the Ad Accounts added through the
  // "+ Load Social Ad Account" flow, which live in the socialAdAccounts
  // collection. The other (non-social) collection is intentionally excluded
  // from the table and its statistics.
  const combinedAccounts = [...(socialAdAccounts || [])];

  const filteredAccounts = combinedAccounts.filter(acc => {
    const effectiveStatus = getEffectiveAccountStatus(acc);
    const matchesSearch = acc.adAccountName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          acc.adAccountId.includes(searchTerm) ||
                          acc.userGroupCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = platformFilter === 'All' ? true : acc.platform === platformFilter;
    const matchesStatus = statusFilter === 'All' ? true : effectiveStatus === statusFilter;
    const matchesAssignment = assignmentFilter === 'All' 
      ? true 
      : assignmentFilter === 'Assigned' 
      ? !!acc.assignedCustomer 
      : !acc.assignedCustomer;
    const matchesSeries = seriesFilter === 'All' ? true : acc.seriesId === seriesFilter;
    return matchesSearch && matchesPlatform && matchesStatus && matchesAssignment && matchesSeries;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, platformFilter, statusFilter, assignmentFilter, seriesFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedAccounts = filteredAccounts.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedAccountIds([]);
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    const start = Math.max(1, safeCurrentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedAccountIds(pagedAccounts.map(acc => acc.adAccountId));
    } else {
      setSelectedAccountIds([]);
    }
  };

  const handleSelectOne = (accountId, checked) => {
    if (checked) {
      setSelectedAccountIds(prev => [...prev, accountId]);
    } else {
      setSelectedAccountIds(prev => prev.filter(id => id !== accountId));
    }
  };

  const handleBulkStatusChange = (status) => {
    if (selectedAccountIds.length > 0) {
      onBulkUpdateStatus(selectedAccountIds, status);
      setSelectedAccountIds([]);
    }
  };

  const handleCreateAccountSubmit = (e) => {
    e.preventDefault();
    const errors = validate(
      {
        accountId: newAccountId,
        name: newAccountName,
        seriesId: newSeriesId,
        adminId: newAdmin,
        bmName: newBmName,
        bmId: newBmId,
        selectCard: newCard,
      },
      {
        accountId: [required('Ad Account ID is required'), maxLength(200)],
        name: [required('Ad Account Name is required'), maxLength(200)],
        seriesId: [required('Please select a series'), maxLength(200)],
        adminId: [maxLength(200)],
        bmName: [maxLength(200)],
        bmId: [maxLength(200)],
        selectCard: [maxLength(200)],
      },
    );
    if (hasErrors(errors)) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});

    // Duplicate AD ACCOUNT ID check scoped strictly to the social ad accounts
    // collection (the only source this page manages). Block creation and prompt
    // the user to edit the existing record instead.
    const enteredId = (newAccountId || '').trim();

    // Check the social ad accounts collection.
    const duplicateSocial = socialAdAccounts.find((a) => (a.adAccountId || '').trim() === enteredId);
    if (duplicateSocial) {
      setAddDuplicateError(duplicateSocial.adAccountId);
      setAddDuplicateSource('social');
      const idField = document.getElementById('add-acc-id');
      idField?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      idField?.focus();
      return;
    }
    setAddDuplicateError('');
    setAddDuplicateSource(null);

    onAddSocialAdAccount({
      adAccountId: newAccountId,
      adAccountName: newAccountName,
      platform: newPlatform,
      seriesId: newSeriesId,
      adminId: newAdmin || undefined,
      bmName: newBmName || undefined,
      bmId: newBmId || undefined,
      selectCard: newCard || undefined,
      billingCard: newCard || undefined,
      accountStatus: newAccountStatus,
    });

    // Reset form
    setNewAccountId('');
    setNewAccountName('');
    setNewPlatform('Facebook');
    setNewAdmin('');
    setNewSeriesId('');
    setNewBmName('');
    setNewBmId('');
    setNewCard('');
    setNewAccountStatus('Active');
    setShowAddModal(false);
  };

  const handleOpenEditModal = (account) => {
    setEditAccountData(account);
    setConfirmDelete(false);
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const handleSaveEditAccount = (e) => {
    e.preventDefault();
    if (!editAccountData) return;

    const isSocial = editAccountData.source === 'social';
    const updateHandler = isSocial ? onUpdateSocialAdAccount : onUpdateAdAccount;
    if (!updateHandler) return;

    const errors = validate(
      {
        name: editAccountData.adAccountName,
        accountId: editAccountData.adAccountId,
        seriesId: editAccountData.seriesId,
        adminId: editAccountData.adminId,
        bmName: editAccountData.bmName,
        bmId: editAccountData.bmId,
        selectCard: editAccountData.selectCard || editAccountData.billingCard,
      },
      {
        name: [required('Ad Account Name is required'), maxLength(200)],
        accountId: [required('Ad Account ID is required'), maxLength(200)],
        seriesId: [maxLength(200)],
        adminId: [maxLength(200)],
        bmName: [maxLength(200)],
        bmId: [maxLength(200)],
        selectCard: [maxLength(200)],
      },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});
    updateHandler(editAccountData);
    setShowEditModal(false);
  };

  const handleDeleteEditAccount = async () => {
    if (!editAccountData) return;
    const isSocial = editAccountData.source === 'social';
    const deleteHandler = isSocial ? onDeleteSocialAdAccount : onDeleteAdAccount;
    if (!deleteHandler) return;
    const id = editAccountData._id || editAccountData.adAccountId;
    try {
      await deleteHandler(id);
      setShowEditModal(false);
      setEditAccountData(null);
      setConfirmDelete(false);
    } catch (err) {
      setConfirmDelete(false);
    }
  };

  const openAssignModal = (account) => {
    setAssignTarget(account);
    setAssignCustomerId(account.assignedCustomer || '');
    setAssignSearchTerm('');
    setShowAssignModal(true);
  };

  const handleAssignAccount = async () => {
    if (!assignTarget || !assignCustomerId) return;
    const isSocial = assignTarget.source === 'social';
    const assignHandler = isSocial ? onAssignSocialAdAccount : onAssignAdAccount;
    if (!assignHandler) return;
    setAssigning(true);
    try {
      await assignHandler(assignTarget.adAccountId, assignCustomerId);
      setShowAssignModal(false);
      setAssignTarget(null);
      setAssignCustomerId('');
      setAssignSearchTerm('');
    } catch (err) {
      // Keep the modal open so the user can retry or pick a different customer.
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignAccount = (acc) => {
    if (!acc) return;
    const unassignHandler = acc.source === 'social' ? onUnassignSocialAdAccount : onUnassignAdAccount;
    if (!unassignHandler) return;
    unassignHandler(acc.adAccountId);
  };

  const getCustomerName = (custId) => {
    if (!custId) return 'Available / Unassigned';
    const c = customers.find(cust => cust.id === custId);
    return c ? c.name : custId;
  };

  const getAssignedCustomer = (custId) => {
    if (!custId) return null;
    return customers.find(cust => cust.id === custId) || null;
  };

  // Live search for the assignment popup — matching users are shown below the
  // search box as the user types (no separate dropdown needed to pick them).
  const matchingCustomers = customers.filter(c => {
    const q = assignSearchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q) ||
      (c.groupId || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });
  const selectedAssignUser = assignCustomerId
    ? getAssignedCustomer(assignCustomerId)
    : null;

  // Statistics are scoped to the social ad account collection shown on this page.
  const allAccounts = [...(socialAdAccounts || [])];

  const totalAdAccounts = allAccounts.length;
  const soldAccounts = allAccounts.filter(acc => getEffectiveAccountStatus(acc) === 'Sold').length;
  const availableAccounts = allAccounts.filter(acc => 
    getEffectiveAccountStatus(acc) === 'Available'
  ).length;
  const needSupportAccounts = allAccounts.filter(acc => isProblemAccountStatus(getEffectiveAccountStatus(acc))).length;
  const terminatedAccounts = allAccounts.filter(acc => getEffectiveAccountStatus(acc) === 'Terminated').length;
  const disabledAccounts = allAccounts.filter(acc => 
    getEffectiveAccountStatus(acc) === 'Disabled' || getEffectiveAccountStatus(acc) === 'Disable'
  ).length;
  const uniqueSeries = new Set(allAccounts.map(acc => acc.seriesId).filter(Boolean)).size;
  const uniquePlatforms = new Set(allAccounts.map(acc => acc.platform).filter(Boolean)).size;

  return (
    <div className="space-y-8 animate-fade-in" id="ad-accounts-view">
      <ErrorBanner error={error} onRetry={onRetry} />
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Ad Account Inventory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time inventory system with automated dollar rates, status triggers, and active assignment logs.</p>
        </div>
        <div>
          <button 
            id="btn-add-account"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/10 cursor-pointer"
          >
            <Plus size={16} /> Load Social Ad Account
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        <StatCard
          title="TOTAL AD ACCOUNTS"
          value={totalAdAccounts}
          variant="blue"
          subtext="All registered social ad accounts"
        />
        <StatCard
          title="NO SERIES"
          value={uniqueSeries}
          variant="indigo"
          subtext="Unique series in inventory"
        />
        <StatCard
          title="NO OF PLATFORM"
          value={uniquePlatforms}
          variant="purple"
          subtext="Platforms represented"
        />
        <StatCard
          title="NO OF SOLD ACCOUNT"
          value={soldAccounts}
          variant="emerald"
          subtext="Assigned or active sold accounts"
        />
        <StatCard
          title="NO OF AVAILABLE ACCOUNT"
          value={availableAccounts}
          variant="amber"
          subtext="Ready for assignment & setup"
        />
        <StatCard
          title="NO OF TERMINATION"
          value={terminatedAccounts}
          variant="red"
          subtext="Terminated ad accounts"
        />
        <StatCard
          title="NO OF NEED SUPPORT"
          value={needSupportAccounts}
          variant="rose"
          subtext="Disabled, restricted, or support required"
        />
        <StatCard
          title="NO OF DISABLE"
          value={disabledAccounts}
          variant="slate"
          subtext="Disabled ad accounts"
        />
      </div>

      {/* Advanced Filter Panel */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Top filter row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              id="account-search"
              type="text"
              placeholder="Search by account name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter 1: Platform */}
            <select
              id="filter-platform"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="All">All Platforms</option>
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Google">Google</option>
              <option value="Snapchat">Snapchat</option>
            </select>

            {/* Filter 2: Account Status */}
            <select
              id="filter-status"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Sold">Sold</option>
              <option value="Disable">Disable</option>
              <option value="Need Support">Need Support</option>
              <option value="Terminated">Terminated</option>
              <option value="Available">Available</option>
            </select>

            {/* Filter 3: Allocation State */}
            <select
              id="filter-allocation"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
              value={assignmentFilter}
              onChange={(e) => setAssignmentFilter(e.target.value)}
            >
              <option value="All">All Allocations</option>
              <option value="Assigned">Assigned Accounts</option>
              <option value="Available">Unassigned Stock</option>
            </select>

            {/* Filter 4: Series */}
            <select
              id="filter-series"
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none"
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
            >
              <option value="All">All Series</option>
              {series.map(s => (
                <option key={s.seriesId} value={s.seriesId}>{s.seriesName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Shelf (only shown when items are selected) */}
        <AnimatePresence>
          {selectedAccountIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex items-center justify-between p-3 bg-blue-50/50 dark:bg-slate-800/30 rounded-xl border border-blue-100 dark:border-slate-800 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedAccountIds.length} ad accounts selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="bulk-active"
                  onClick={() => handleBulkStatusChange('Active')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded"
                >
                  Bulk Active
                </button>
                <button
                  id="bulk-terminate"
                  onClick={() => handleBulkStatusChange('Terminated')}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded"
                >
                  Bulk Terminated
                </button>
                <button
                  id="bulk-disable"
                  onClick={() => handleBulkStatusChange('Disabled')}
                  className="bg-slate-700 hover:bg-slate-800 text-white font-semibold text-[10px] px-2.5 py-1.5 rounded"
                >
                  Bulk Disabled
                </button>
                <button
                  onClick={() => setSelectedAccountIds([])}
                  className="text-slate-400 hover:text-slate-600 text-[10px] px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Table Ledger */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm shadow-slate-100 dark:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-600 dark:text-slate-400 select-text" id="accounts-table">
<thead className="bg-slate-50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-500 font-bold border-b border-slate-100 dark:border-slate-800/80">
              <tr>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider w-10 pl-4">
                  <input
                    type="checkbox"
                    checked={pagedAccounts.length > 0 && selectedAccountIds.length === pagedAccounts.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                 <th scope="col" className="py-3.5 text-left uppercase text-[10px] tracking-wider px-3">Ad Account Name / ID</th>
                 <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Platform</th>
                 <th scope="col" className="py-3.5 text-left uppercase text-[10px] tracking-wider px-3">BM Name / ID</th>
                 <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Billing Card</th>
                 <th scope="col" className="py-3.5 text-left uppercase text-[10px] tracking-wider px-3">User</th>
                 <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Status</th>
                 <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 select-text">
              {pagedAccounts.map((acc) => {
                 const isChecked = selectedAccountIds.includes(acc.adAccountId);
                 const effectiveStatus = getEffectiveAccountStatus(acc);
                 const assignedCustomer = getAssignedCustomer(acc.assignedCustomer);
                return (
                  <tr key={acc.adAccountId} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors ${
                    isChecked ? 'bg-blue-50/10 dark:bg-blue-950/5' : ''
                  }`}>
                    <td className="py-3.5 text-center pl-4">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleSelectOne(acc.adAccountId, e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3.5 px-3 text-left">
                      <div className="font-bold text-slate-900 dark:text-white text-xs max-w-[180px] truncate cursor-pointer hover:underline" title={acc.adAccountName} onClick={() => copyToClipboard(acc.adAccountName, `name-${acc.adAccountId}`)}>
                        {acc.adAccountName}
                        {copiedCell === `name-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 cursor-pointer hover:underline" onClick={() => copyToClipboard(acc.adAccountId, `id-${acc.adAccountId}`)}>
                        ID: {acc.adAccountId}
                        {copiedCell === `id-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                      </div>
                      {acc.assignAdAccount && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">
                          Assigned: {acc.assignAdAccount}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs">
                        <PlatformText platform={acc.platform} variant="badge" />
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-left">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[150px] cursor-pointer hover:underline" title={acc.bmName || 'N/A'} onClick={() => copyToClipboard(acc.bmName || '', `bm-name-${acc.adAccountId}`)}>
                        {acc.bmName || 'N/A'}
                        {copiedCell === `bm-name-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                      </div>
                      {acc.bmId && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5 cursor-pointer hover:underline" onClick={() => copyToClipboard(acc.bmId, `bm-id-${acc.adAccountId}`)}>
                          BM ID: {acc.bmId}
                          {copiedCell === `bm-id-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                      {acc.billingCard ? (
                        <div className="inline-flex items-center gap-1 cursor-pointer hover:underline" onClick={() => copyToClipboard(acc.billingCard, `billing-${acc.adAccountId}`)}>
                          <CreditCard size={11} className="text-slate-400 shrink-0" />
                          <span>{acc.billingCard}</span>
                          {copiedCell === `billing-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-left">
                      {assignedCustomer ? (
                        <div className="flex flex-col items-start text-left">
                          <span className="font-semibold text-slate-900 dark:text-white text-xs truncate max-w-[140px] cursor-pointer hover:underline" title={assignedCustomer.name} onClick={() => copyToClipboard(assignedCustomer.name, `user-name-${acc.adAccountId}`)}>
                            {assignedCustomer.name}
                            {copiedCell === `user-name-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5 cursor-pointer hover:underline" title={assignedCustomer.groupId} onClick={() => copyToClipboard(assignedCustomer.groupId, `user-group-${acc.adAccountId}`)}>
                            {assignedCustomer.groupId}
                            {copiedCell === `user-group-${acc.adAccountId}` && <span className="ml-1.5 text-[10px] text-emerald-600 font-semibold">Copied</span>}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-xs">
                      <span className="inline-flex items-center justify-center min-w-[90px] bg-brand-orange text-white text-[10px] font-bold px-3 py-1 rounded-full shadow">
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditModal(acc)}
                            leftIcon={<FileEdit size={11} />}
                          >
                            Edit
                          </Button>
                          {acc.assignedCustomer ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnassignAccount(acc)}
                              leftIcon={<User size={11} />}
                            >
                              Unassign
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignModal(acc)}
                              leftIcon={<User size={11} />}
                            >
                              Assign
                            </Button>
                          )}
                        </div>
                        <select
                          id={`quick-action-${acc.adAccountId}`}
                          defaultValue=""
                          onChange={async (e) => {
                            const value = e.target.value;
                            if (!value) return;
                            if (acc.source === 'social' && onUpdateSocialAdAccount) {
                              await onUpdateSocialAdAccount({ ...acc, accountStatus: value });
                            } else if (onUpdateAccountStatus) {
                              onUpdateAccountStatus(acc.adAccountId, value);
                            }
                            e.target.value = '';
                          }}
                          className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 text-slate-700 dark:text-slate-200 font-medium"
                        >
                          <option value="" disabled>Quick Action...</option>
                          <option value="Active">Activate</option>
                          <option value="Available">Make Available</option>
                          <option value="Sold">Mark Sold</option>
                          <option value="Disabled">Disable</option>
                          <option value="Need Support">Need Support</option>
                          <option value="Terminated">Terminated</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                    No ad accounts match search or selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {filteredAccounts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 pt-1 pb-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Showing {(safeCurrentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(safeCurrentPage * ITEMS_PER_PAGE, filteredAccounts.length)} of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredAccounts.length}</span>{' '}
            ad accounts
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePageChange(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Prev
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => handlePageChange(page)}
                className={`min-w-[32px] px-2 py-1.5 rounded-lg text-xs font-bold transition ${
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
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Account Loading Drawer/Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddFormErrors({}); }}
        title="Load Social Ad Account Inventory"
        description="Catalog new advertising account into the ERP system."
        size="xl"
        variant="animated"
        scrollable
      >
        <form onSubmit={handleCreateAccountSubmit} className="p-6 space-y-4" id="form-add-account">
          {addDuplicateError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 p-3.5 animate-fade-in">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertTriangle size={16} className="text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Ad Account Already Exists</p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-500/80 mt-0.5 break-words">
                    An ad account with AD ACCOUNT ID <strong className="font-extrabold">{addDuplicateError}</strong> already exists {addDuplicateSource === 'social' ? 'in the Load Social Ad Account entries' : 'in the inventory'}.
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-500/80 mt-0.5">
                    The existing account should be used/edited instead of creating a duplicate.
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const existing =
                      (addDuplicateSource === 'social'
                        ? socialAdAccounts
                        : adAccounts
                      ).find(
                        (a) => (a.adAccountId || '').trim() === (addDuplicateError || '').trim(),
                      );
                    setShowAddModal(false);
                    setAddDuplicateError('');
                    setAddDuplicateSource(null);
                    if (existing) handleOpenEditModal(existing);
                  }}
                >
                  Edit existing
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ad Account Name</label>
              <input
                id="add-acc-name"
                type="text"
                required
                placeholder="e.g. ADS_Adsbuzz_Agency_B_612"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
              <FieldError error={addFormErrors.name} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ad Account ID</label>
              <input
                id="add-acc-id"
                type="text"
                required
                placeholder="e.g. 1596456534457495"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newAccountId}
                onChange={(e) => { setNewAccountId(e.target.value); setAddDuplicateError(''); }}
              />
              <FieldError error={addFormErrors.accountId} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform</label>
              <select
                id="add-acc-platform"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
              >
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Series</label>
              <select
                id="add-acc-series"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newSeriesId}
                onChange={(e) => setNewSeriesId(e.target.value)}
              >
                <option value="">Select Series</option>
                {series
                  .filter(s => !s.platform || s.platform === newPlatform)
                  .map(s => (
                    <option key={s.seriesId} value={s.seriesId}>{s.seriesName}</option>
                  ))}
              </select>
              <FieldError error={addFormErrors.seriesId} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Admin ID</label>
              <input
                id="add-acc-admin-id"
                type="text"
                placeholder="e.g. ADM-1098"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newAdmin}
                onChange={(e) => setNewAdmin(e.target.value)}
              />
              <FieldError error={addFormErrors.adminId} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Manager Name</label>
              <input
                id="add-acc-bm-name"
                type="text"
                placeholder="e.g. AdsBuzz MCC Hub"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newBmName}
                onChange={(e) => setNewBmName(e.target.value)}
              />
              <FieldError error={addFormErrors.bmName} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Manager ID</label>
              <input
                id="add-acc-bm-id"
                type="text"
                placeholder="e.g. BM-994321"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newBmId}
                onChange={(e) => setNewBmId(e.target.value)}
              />
              <FieldError error={addFormErrors.bmId} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Card</label>
              <select
                id="add-acc-card"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newCard}
                onChange={(e) => setNewCard(e.target.value)}
              >
                <option value="">No Card Linked</option>
                {cards.map(c => (
                  <option key={c.id} value={c.cardName}>{c.cardName} ({c.cardPlatform || c.id})</option>
                ))}
              </select>
              <FieldError error={addFormErrors.selectCard} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
              <select
                id="add-acc-status"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={newAccountStatus}
                onChange={(e) => setNewAccountStatus(e.target.value)}
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit">Confirm Entry</Button>
          </div>
        </form>
      </Modal>

{/* Edit Ad Account Modal */}
      <Modal
        isOpen={showEditModal && !!editAccountData}
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); setConfirmDelete(false); }}
        title="Edit Ad Account Record"
        description={editAccountData ? `Update parameters for ${editAccountData.adAccountName} (${editAccountData.adAccountId})` : undefined}
        size="xl"
        variant="animated"
        scrollable
      >
        <form onSubmit={handleSaveEditAccount} className="p-6 space-y-4" id="form-edit-account">
          {/* Assignment Info */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Assigned To:{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {editAccountData?.assignedCustomer
                  ? getCustomerName(editAccountData.assignedCustomer)
                  : 'Available / Unassigned'}
              </span>
            </span>
            {editAccountData?.assignedCustomer && (
              <span className="text-[10px] font-mono text-slate-400">
                ID: {editAccountData.assignedCustomer}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ad Account Name</label>
              <input
                id="edit-acc-name"
                type="text"
                required
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-semibold"
                value={editAccountData?.adAccountName ?? ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, adAccountName: e.target.value })}
              />
              <FieldError error={editFormErrors.name} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ad Account ID</label>
              <input
                id="edit-acc-id"
                type="text"
                disabled
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 rounded-xl font-mono text-slate-500 cursor-not-allowed"
                value={editAccountData?.adAccountId ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Platform</label>
              <select
                id="edit-acc-platform"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.platform ?? 'Facebook'}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, platform: e.target.value })}
              >
                <option value="Facebook">Facebook</option>
                <option value="TikTok">TikTok</option>
                <option value="Google">Google</option>
                <option value="Snapchat">Snapchat</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Series</label>
              <select
                id="edit-acc-series"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.seriesId ?? ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, seriesId: e.target.value })}
              >
                <option value="">Select Series</option>
                {series
                  .filter(s => editAccountData && (!s.platform || s.platform === editAccountData.platform))
                  .map(s => (
                    <option key={s.seriesId} value={s.seriesId}>{s.seriesName}</option>
                  ))}
              </select>
              <FieldError error={editFormErrors.seriesId} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Admin ID</label>
              <input
                id="edit-acc-admin-id"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.adminId || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, adminId: e.target.value })}
              />
              <FieldError error={editFormErrors.adminId} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Manager Name</label>
              <input
                id="edit-acc-bm-name"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.bmName || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, bmName: e.target.value })}
              />
              <FieldError error={editFormErrors.bmName} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Manager ID</label>
              <input
                id="edit-acc-bm-id"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.bmId || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, bmId: e.target.value })}
              />
              <FieldError error={editFormErrors.bmId} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Card</label>
              <select
                id="edit-acc-card"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.selectCard || editAccountData?.billingCard || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, selectCard: e.target.value, billingCard: e.target.value })}
              >
                <option value="">No Card Linked</option>
                {cards.map(c => (
                  <option key={c.id} value={c.cardName}>{c.cardName} ({c.cardPlatform || c.id})</option>
                ))}
              </select>
              <FieldError error={editFormErrors.selectCard} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
              <select
                id="edit-acc-status"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={editAccountData?.accountStatus || 'Active'}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, accountStatus: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Available">Available</option>
                <option value="Sold">Sold</option>
                <option value="Disabled">Disabled</option>
                <option value="Pending">Pending</option>
                <option value="Need Support">Need Support</option>
                <option value="Terminated">Terminated</option>
              </select>
            </div>
          </div>

          <div className="custom-modal-footer flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">Delete this account?</span>
                  <Button variant="danger" size="sm" onClick={handleDeleteEditAccount}>Yes, Delete</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                </div>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setConfirmDelete(true)}
                  leftIcon={<Trash2 size={13} />}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => { setShowEditModal(false); setConfirmDelete(false); }}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Assign Ad Account Modal */}
      <Modal
        isOpen={showAssignModal && !!assignTarget}
        onClose={() => { setShowAssignModal(false); setAssignTarget(null); setAssignCustomerId(''); setAssignSearchTerm(''); }}
        title="Assign Ad Account"
        description={assignTarget ? `Select a user to assign ${assignTarget.adAccountName} (${assignTarget.adAccountId}).` : undefined}
        size="md"
        variant="animated"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleAssignAccount(); }}
          className="p-6 space-y-4"
          id="form-assign-account"
        >
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Search User by Name</label>
            <div className="relative">
              <input
                id="assign-user-search"
                type="text"
                placeholder="Type to search users..."
                value={assignSearchTerm}
                onChange={(e) => setAssignSearchTerm(e.target.value)}
                className="w-full text-xs pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100"
              />
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign To Customer</label>
            {customers.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic mt-1">No customers available to assign.</p>
            ) : (
              <>
                {matchingCustomers.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic mt-1">No users match your search.</p>
                ) : (
                  <ul className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                    {matchingCustomers.map(c => {
                      const isSelected = assignCustomerId === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setAssignCustomerId(c.id)}
                            className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-xs transition-colors ${
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/40'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }`}
                          >
                            <span className="flex flex-col min-w-0">
                              <span className={`font-bold truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}`}>
                                {c.name}
                              </span>
                              {c.groupId && (
                                <span className="text-[10px] font-mono text-slate-400 truncate">
                                  Group: {c.groupId}
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] font-mono text-slate-400">{c.id}</span>
                              {isSelected && <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-400" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
            {selectedAssignUser && (
              <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1.5 font-semibold">
                Selected: {selectedAssignUser.name} ({selectedAssignUser.id})
                {selectedAssignUser.groupId ? ` · Group ${selectedAssignUser.groupId}` : ''}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => { setShowAssignModal(false); setAssignTarget(null); setAssignCustomerId(''); setAssignSearchTerm(''); }} disabled={assigning}>Cancel</Button>
            <Button
              type="submit"
              disabled={!assignCustomerId || assigning}
              leftIcon={assigning ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
              ) : undefined}
            >
              {assigning ? 'Assigning…' : 'Confirm Assignment'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default memo(AdAccountsView);

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
import { validate, hasErrors, required, positiveNumber, maxLength } from '@/utils/formValidation';

function AdAccountsView({
  adAccounts,
  customers,
  cards,
  series,
  onAddAdAccount,
  onUpdateAdAccount,
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

  // Add Account Modal
  const [showAddModal, setShowAddModal] = useState(autoOpenAddModal);
  const [newAccountId, setNewAccountId] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newPlatform, setNewPlatform] = useState('Facebook');
  const [newAccountType, setNewAccountType] = useState('Agency Account');
  const [newRate, setNewRate] = useState(132);
  const [newSpend, setNewRateSpend] = useState(1000);
  const [newOwner, setNewOwner] = useState('ADSBUZZ');
  const [newGroupCode, setNewGroupCode] = useState('GC-700');
  const [newBmId, setNewBmId] = useState('');
  const [newBmName, setNewBmName] = useState('');
  const [newCard, setNewCard] = useState('');
  const [newSeriesId, setNewSeriesId] = useState('');
  const [newAssignAdAccount, setNewAssignAdAccount] = useState('');
  const [newProductType, setNewProductType] = useState('');
  const [newFundAccountStatus, setNewFundAccountStatus] = useState(true);
  const [newAccountStatus, setNewAccountStatus] = useState('Available');
  const [seriesFilter, setSeriesFilter] = useState('All');

  // Edit Account Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAccountData, setEditAccountData] = useState(null);

  // Form validation state
  const [addFormErrors, setAddFormErrors] = useState({});
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

  const getAccountStatusTextClass = (status) => {
    if (status === 'Available' || status === 'Sold') return 'account-status-success';
    if (isProblemAccountStatus(status)) return 'account-status-danger';
    return 'text-brand-blue-dark dark:text-brand-blue-dark';
  };

  const filteredAccounts = adAccounts.filter(acc => {
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
        rate: newRate,
        spend: newSpend,
      },
      {
        accountId: [required('Ad Account ID is required'), maxLength(64)],
        name: [required('Ad Account Name is required'), maxLength(200)],
        rate: positiveNumber('Dollar rate must be greater than 0'),
        spend: positiveNumber('Monthly spend must be greater than 0'),
      },
    );
    if (hasErrors(errors)) {
      setAddFormErrors(errors);
      return;
    }
    setAddFormErrors({});

    onAddAdAccount({
      adAccountId: newAccountId,
      adAccountName: newAccountName,
      platform: newPlatform,
      accountType: newAccountType,
      dollarRate: Number(newRate),
      monthlySpending: Number(newSpend),
      accountOwner: newOwner,
      userGroupCode: newGroupCode,
      accountStatus: newAccountStatus,
      bmId: newBmId || undefined,
      bmName: newBmName || undefined,
      billingCard: newCard || undefined,
      selectCard: newCard || undefined,
      seriesId: newSeriesId || undefined,
      assignAdAccount: newAssignAdAccount || undefined,
      productType: newProductType || undefined,
      fundAccountStatus: newFundAccountStatus
    });

    // Reset forms
    setNewAccountId('');
    setNewAccountName('');
    setNewPlatform('Facebook');
    setNewRate(132);
    setNewRateSpend(1000);
    setNewOwner('ADSBUZZ');
    setNewGroupCode('GC-700');
    setNewBmId('');
    setNewBmName('');
    setNewCard('');
    setNewSeriesId('');
    setNewAssignAdAccount('');
    setNewProductType('');
    setNewFundAccountStatus(true);
    setNewAccountStatus('Available');
    setShowAddModal(false);
  };

  const handleOpenEditModal = (account) => {
    setEditAccountData({
      ...account,
      accountStatus: account.accountStatus === 'Active' ? 'Sold' : account.accountStatus,
    });
    setShowEditModal(true);
  };

  const handleSaveEditAccount = (e) => {
    e.preventDefault();
    if (!editAccountData || !onUpdateAdAccount) return;
    const errors = validate(
      {
        name: editAccountData.adAccountName,
        rate: editAccountData.dollarRate,
        spend: editAccountData.monthlySpending,
      },
      {
        name: [required('Ad Account Name is required'), maxLength(200)],
        rate: positiveNumber('Dollar rate must be greater than 0'),
        spend: positiveNumber('Monthly spend must be greater than 0'),
      },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    setEditFormErrors({});
    onUpdateAdAccount(editAccountData);
    setShowEditModal(false);
  };

  const getCustomerName = (custId) => {
    if (!custId) return 'Available / Unassigned';
    const c = customers.find(cust => cust.id === custId);
    return c ? c.name : 'Unknown Customer';
  };

  const totalAdAccounts = adAccounts.length;
  const soldAccounts = adAccounts.filter(acc => getEffectiveAccountStatus(acc) === 'Sold').length;
  const needSupportAccounts = adAccounts.filter(acc => isProblemAccountStatus(getEffectiveAccountStatus(acc))).length;
  const availableAccounts = adAccounts.filter(acc => 
    getEffectiveAccountStatus(acc) === 'Available'
  ).length;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="TOTAL AD ACCOUNTS"
          value={totalAdAccounts}
          variant="blue"
          subtext="All registered social ad accounts"
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
          title="NO OF NEED SUPPORT"
          value={needSupportAccounts}
          variant="rose"
          subtext="Disabled, restricted, or support required"
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
          <table className="w-full text-center text-xs text-slate-600 dark:text-slate-400" id="accounts-table">
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
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Ad Account Name / ID</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Platform</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Type &amp; Owner</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Group Code</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Dollar Rate</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Monthly Spend</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">BM Details</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Billing Card</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Status</th>
                <th scope="col" className="py-3.5 text-center uppercase text-[10px] tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {pagedAccounts.map((acc) => {
                const isChecked = selectedAccountIds.includes(acc.adAccountId);
                const effectiveStatus = getEffectiveAccountStatus(acc);
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
                    <td className="py-3.5 px-3 text-center">
                      <div className="font-bold text-slate-900 dark:text-white text-xs max-w-[180px] mx-auto truncate" title={acc.adAccountName}>
                        {acc.adAccountName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        ID: {acc.adAccountId}
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
                    <td className="py-3.5 text-center">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                        {acc.accountType}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                        <span className="text-slate-400">Owner:</span> {acc.accountOwner || 'N/A'}
                      </div>
                    </td>
                    <td className="py-3.5 text-center font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      {acc.userGroupCode}
                    </td>
                    <td className="py-3.5 text-center font-bold text-slate-900 dark:text-white">
                      ৳{acc.dollarRate}
                    </td>
                    <td className="py-3.5 text-center font-bold text-slate-900 dark:text-white">
                      ${(acc.monthlySpending || 0).toLocaleString()}
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[150px] mx-auto" title={acc.bmName || 'N/A'}>
                        {acc.bmName || 'N/A'}
                      </div>
                      {acc.bmId && (
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          BM ID: {acc.bmId}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
                      {acc.billingCard ? (
                        <div className="inline-flex items-center gap-1">
                          <CreditCard size={11} className="text-slate-400 shrink-0" />
                          <span>{acc.billingCard}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">-</span>
                      )}
                    </td>
                    <td className="py-3.5 text-center font-bold text-xs">
                      <span className={getAccountStatusTextClass(effectiveStatus)}>
                        {effectiveStatus}
                      </span>
                    </td>
                    <td className="py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(acc)}
                          leftIcon={<FileEdit size={11} />}
                        >
                          Edit
                        </Button>
                        <select
                          id={`status-select-${acc.adAccountId}`}
                          className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 text-slate-700 dark:text-slate-200 font-medium"
                          value={acc.accountStatus === 'Active' ? 'Sold' : acc.accountStatus}
                          onChange={(e) => onUpdateAccountStatus(acc.adAccountId, e.target.value)}
                        >
                          <option value="Sold">Sold</option>
                          <option value="Disable">Disable</option>
                          <option value="Need Support">Need Support</option>
                          <option value="Terminated">Terminated</option>
                          <option value="Available">Available</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-slate-400 italic">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Ad Account ID</label>
              <input
                id="add-acc-id"
                type="text"
                required
                placeholder="e.g. 1596456534457495"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
              />
              <FieldError error={addFormErrors.accountId} />
            </div>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Dollar Rate (BDT)</label>
              <input
                id="add-acc-rate"
                type="number"
                required
                placeholder="132"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={newRate}
                onChange={(e) => setNewRate(Number(e.target.value))}
              />
              <FieldError error={addFormErrors.rate} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Avg Monthly Spend</label>
              <input
                id="add-acc-spend"
                type="number"
                placeholder="1000"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newSpend}
                onChange={(e) => setNewRateSpend(Number(e.target.value))}
              />
              <FieldError error={addFormErrors.spend} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign Ad Account</label>
              <input
                id="add-acc-assign"
                type="text"
                placeholder="e.g. Assigned Customer / Team"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newAssignAdAccount}
                onChange={(e) => setNewAssignAdAccount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Product Type</label>
              <input
                id="add-acc-product-type"
                type="text"
                placeholder="e.g. E-Commerce / App / Agency"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newProductType}
                onChange={(e) => setNewProductType(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Card (Billing Card)</label>
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
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
              <select
                id="add-acc-status"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={newAccountStatus}
                onChange={(e) => setNewAccountStatus(e.target.value)}
              >
                <option value="Sold">Sold</option>
                <option value="Disable">Disable</option>
                <option value="Need Support">Need Support</option>
                <option value="Terminated">Terminated</option>
                <option value="Available">Available</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Owner</label>
              <input
                id="add-acc-owner"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">User Group Code</label>
              <input
                id="add-acc-group-code"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newGroupCode}
                onChange={(e) => setNewGroupCode(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Fund Account Status</label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newFundAccountStatus}
                  aria-label="Fund account status"
                  onClick={() => setNewFundAccountStatus(!newFundAccountStatus)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    newFundAccountStatus ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    newFundAccountStatus ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {newFundAccountStatus ? 'Funded' : 'Unfunded'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">BM ID</label>
              <input
                id="add-acc-bm-id"
                type="text"
                placeholder="e.g. BM-994321"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={newBmId}
                onChange={(e) => setNewBmId(e.target.value)}
              />
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
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); }}
        title="Edit Ad Account Record"
        description={editAccountData ? `Update parameters for ${editAccountData.adAccountName} (${editAccountData.adAccountId})` : undefined}
        size="xl"
        variant="animated"
        scrollable
      >
        <form onSubmit={handleSaveEditAccount} className="p-6 space-y-4" id="form-edit-account">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Dollar Rate (BDT)</label>
              <input
                id="edit-acc-rate"
                type="number"
                required
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={editAccountData?.dollarRate ?? 0}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, dollarRate: Number(e.target.value) })}
              />
              <FieldError error={editFormErrors.rate} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Avg Monthly Spend</label>
              <input
                id="edit-acc-spend"
                type="number"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.monthlySpending ?? 0}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, monthlySpending: Number(e.target.value) })}
              />
              <FieldError error={editFormErrors.spend} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Assign Ad Account</label>
              <input
                id="edit-acc-assign"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.assignAdAccount || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, assignAdAccount: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Product Type</label>
              <input
                id="edit-acc-product-type"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.productType || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, productType: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Select Card (Billing Card)</label>
              <select
                id="edit-acc-card"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.billingCard || editAccountData?.selectCard || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, billingCard: e.target.value, selectCard: e.target.value })}
              >
                <option value="">No Card Linked</option>
                {cards.map(c => (
                  <option key={c.id} value={c.cardName}>{c.cardName} ({c.cardPlatform || c.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
              <select
                id="edit-acc-status"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={editAccountData?.accountStatus ?? 'Available'}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, accountStatus: e.target.value })}
              >
                <option value="Sold">Sold</option>
                <option value="Disable">Disable</option>
                <option value="Need Support">Need Support</option>
                <option value="Terminated">Terminated</option>
                <option value="Available">Available</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Owner</label>
              <input
                id="edit-acc-owner"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.accountOwner ?? ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, accountOwner: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">User Group Code</label>
              <input
                id="edit-acc-group-code"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.userGroupCode ?? ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, userGroupCode: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Fund Account Status</label>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!editAccountData?.fundAccountStatus}
                  aria-label="Fund account status"
                  onClick={() => editAccountData && setEditAccountData({ ...editAccountData, fundAccountStatus: !editAccountData.fundAccountStatus })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editAccountData?.fundAccountStatus ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editAccountData?.fundAccountStatus ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {editAccountData?.fundAccountStatus ? 'Funded' : 'Unfunded'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Manager Name</label>
              <input
                id="edit-acc-bm-name"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editAccountData?.bmName || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, bmName: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">BM ID</label>
              <input
                id="edit-acc-bm-id"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-mono"
                value={editAccountData?.bmId || ''}
                onChange={(e) => editAccountData && setEditAccountData({ ...editAccountData, bmId: e.target.value })}
              />
            </div>
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

    </div>
  );
}

export default memo(AdAccountsView);

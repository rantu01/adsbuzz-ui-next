'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  Filter,
  Star,
  Phone,
  Layers,
  UserPlus
} from 'lucide-react';
import SummaryCard from '@/components/common/SummaryCard';
import Pagination from '@/components/common/Pagination';
import CustomerDetailsPane from '@/components/views/CustomerDetailsPane';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import FieldError from '@/components/ui/FieldError';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { validate, hasErrors, required, email, phone, positiveNumber, maxLength } from '@/utils/formValidation';

const CustomerRow = memo(function CustomerRow({ cust, isSelected, stats, onSelect }) {
  return (
    <div
      id={`customer-item-${cust.id}`}
      onClick={() => onSelect(cust.id)}
      className={`p-3 flex items-center justify-between cursor-pointer transition-all ${
        isSelected
          ? 'bg-[#f8fafc] dark:bg-slate-100 border-l-4 border-brand-blue shadow-xs text-slate-950'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-l-4 border-transparent'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-6 w-6 rounded-md bg-brand-orange text-white font-black text-[9px] flex items-center justify-center flex-shrink-0 shadow-xs">
          {cust.avatar || cust.name.slice(0, 2).toUpperCase()}
        </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-slate-950' : 'text-slate-900 dark:text-white'}`}>{cust.name}</h3>
              {cust.favorite && <Star size={9} className="text-amber-500 fill-amber-500" />}
            </div>
            <p className={`text-[10px] font-mono font-bold mt-0.5 ${isSelected ? 'text-brand-blue' : 'text-brand-blue dark:text-blue-400'}`}>
              ID: {cust.id || '—'}
            </p>
            <p className={`text-[10px] font-mono truncate mt-0.5 ${isSelected ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
              Group: {cust.groupId || 'GC-GENERIC'}
            </p>
            <p className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>{cust.companyName}</p>
          </div>
      </div>
      <div className="text-right flex-shrink-0 pl-2">
        <p className={`text-xs font-black ${isSelected ? 'text-slate-950' : 'text-slate-800 dark:text-slate-200'}`}>
          ${stats?.totalUSD?.toLocaleString() || '0'} USD
        </p>
        <p className={`text-[10px] font-bold mt-0.5 ${isSelected ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
          ৳{stats?.totalBDT?.toLocaleString() || '0'} BDT
        </p>
        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{stats?.activeAccounts || 0} active acc.</p>
      </div>
    </div>
  );
});

function CustomersView({
  customers,
  loading = false,
  error,
  onRetry,
  socialAdAccounts = [],
  invoices,
  setups = [],
  onAddCustomer,
  onUpdateCustomer,
  onUpdateCustomerNotes,
  onToggleFavorite,
  onDeleteCustomer,
  onAssignAdAccount,
  onUnassignAdAccount,
  onAssignSocialAdAccount,
  onUnassignSocialAdAccount,
  onTriggerTopup,
  onTriggerAssign,
  onConfigureSaleSetup,
  autoOpenAddModal = false,
  initialCustomerId,
}) {
  const [searchTerm, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [favoriteFilter, setFavoriteFilter] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || customers[0]?.id || '');

  // Quick Customer Creation state
  const [showAddModal, setShowAddModal] = useState(autoOpenAddModal);
  const [newCustName, setNewCustName] = useState('');
  const [newCustGroupId, setNewCustGroupId] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCompany, setNewCustCompany] = useState('');
  const [newCustMonthlySpend, setNewCustMonthlySpend] = useState(1000);

  // Edit Customer Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCustData, setEditCustData] = useState(null);

  // Form validation state
  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});

   // Assign Ad Account state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetAccountId, setAssignTargetAccountId] = useState('');
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Delete Customer state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Pagination
  const LIST_PAGE_SIZE = 10;
  const [customerPage, setCustomerPage] = useState(1);

  // Reset list page when filters change
  useEffect(() => {
    setCustomerPage(1);
  }, [searchTerm, statusFilter, favoriteFilter]);

  // Selected customer data
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  // Precompute per-customer aggregates once so filtering/rendering avoids repeated
  // O(n) scans of adAccounts/invoices and customers on every render. Social ad
  // accounts (the single source of Ad Account data) are used so they surface in
  // the "Assigned Ad Accounts" tab exactly like inventory accounts.
  const customerStats = useMemo(() => {
    const allAccounts = [...(socialAdAccounts || [])];
    const map = {};
    for (const cust of customers) {
      const id = cust.id;
      const gid = cust.groupId;
      const accounts = allAccounts.filter(a => a.assignedCustomer === id);
      const invs = invoices.filter(inv => inv.customerId === id || (inv.groupId && gid === inv.groupId));
      map[id] = {
        accounts,
        activeAccounts: accounts.length,
        invoices: invs,
        totalUSD: invs.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0),
        totalBDT: invs.reduce((sum, inv) => sum + (inv.paidAmountBDT || 0), 0),
      };
    }
    return map;
  }, [customers, socialAdAccounts, invoices]);

  const getCustomerStats = useCallback(
    (custId) => {
      const s = customerStats[custId];
      return s || { accounts: [], activeAccounts: 0, invoices: [], totalUSD: 0, totalBDT: 0 };
    },
    [customerStats],
  );

  // Group ID uniqueness helpers (Task 3)
  const groupIds = useMemo(
    () => new Set(customers.map((c) => c.groupId).filter(Boolean)),
    [customers],
  );

  const groupIdIsUnique = useCallback(
    (groupId, excludeId = null) => {
      const candidate = (groupId || '').trim().toUpperCase();
      if (!candidate) return true;
      if (!groupIds.has(candidate)) return true;
      // If the only match belongs to the customer being edited, it's still unique.
      if (excludeId) {
        const owner = customers.find((c) => c.groupId === candidate);
        return !owner || owner.id === excludeId;
      }
      return false;
    },
    [groupIds, customers],
  );

  const suggestUniqueGroupId = useCallback(
    (name) => {
      const base = (name || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      let candidate = `GC-${base || 'CUST'}`;
      let suffix = 1;
      while (!groupIdIsUnique(candidate)) {
        candidate = `GC-${base || 'CUST'}-${suffix}`;
        suffix += 1;
      }
      return candidate;
    },
    [groupIdIsUnique],
  );

  const filteredCustomers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return customers.filter(c => {
      const matchesSearch = !q ||
                            c.name.toLowerCase().includes(q) ||
                            (c.companyName || '').toLowerCase().includes(q) ||
                            (c.email || '').toLowerCase().includes(q) ||
                            (c.groupId && c.groupId.toLowerCase().includes(q)) ||
                            (c.id && c.id.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' ? true : c.status === statusFilter;
      const matchesFav = favoriteFilter ? c.favorite === true : true;
      return matchesSearch && matchesStatus && matchesFav;
    });
  }, [customers, searchTerm, statusFilter, favoriteFilter]);

  const customerMetrics = useMemo(() => {
    const statsLoading = loading && customers.length === 0;
    return {
      loading: statsLoading,
      totalUsers: customers.length,
      activeUsers: customers.filter(c => c.status === 'Active').length,
      favoriteUsers: customers.filter(c => c.favorite === true).length,
    };
  }, [customers, loading]);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / LIST_PAGE_SIZE));
  const pagedCustomers = useMemo(
    () => filteredCustomers.slice((customerPage - 1) * LIST_PAGE_SIZE, customerPage * LIST_PAGE_SIZE),
    [filteredCustomers, customerPage, LIST_PAGE_SIZE],
  );

  const handleSelectCustomer = useCallback((custId) => {
    setSelectedCustomerId(custId);
  }, []);

  const assignableAdAccounts = useMemo(() => {
    // Unassigned accounts from the social ad accounts collection, so accounts
    // loaded on the Ad Account Inventory page are assignable/searchable here.
    const combined = [...(socialAdAccounts || [])];
    return combined.filter(acc => !acc.assignedCustomer);
  }, [socialAdAccounts]);

  const handleOpenAssignModal = useCallback(() => {
    setAssignTargetAccountId('');
    setAssignSearchTerm('');
    setShowAssignModal(true);
  }, []);

  const handleRequestDelete = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleConfirmAssign = async () => {
    if (!selectedCustomer || !assignTargetAccountId) return;
    setAssigning(true);
    try {
      const isSocial = (socialAdAccounts || []).some(a => a.adAccountId === assignTargetAccountId);
      const assignHandler = isSocial ? onAssignSocialAdAccount : onAssignAdAccount;
      if (!assignHandler) throw new Error('Assignment handler missing.');
      await assignHandler(assignTargetAccountId, selectedCustomer.id);
      setShowAssignModal(false);
      setAssignTargetAccountId('');
    } catch {
      // Error toast raised by the hook; keep the modal open so the user can retry.
    } finally {
      setAssigning(false);
    }
  };

  // Route the "Unassign" action in the customer details pane to the social
  // handler when the assigned account lives in the social collection. The reason
  // captured from the pane's popup is forwarded so it can be persisted + logged.
  const handlePaneUnassign = useCallback(
    (adAccountId, reason) => {
      const isSocial = (socialAdAccounts || []).some(a => a.adAccountId === adAccountId);
      const unassignHandler = isSocial ? onUnassignSocialAdAccount : onUnassignAdAccount;
      if (unassignHandler) unassignHandler(adAccountId, reason);
    },
    [socialAdAccounts, onUnassignAdAccount, onUnassignSocialAdAccount],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!selectedCustomer) return;
    const deletedId = selectedCustomer.id;
    onDeleteCustomer(deletedId).catch(() => {});
    setShowDeleteModal(false);
    const remaining = customers.filter(c => c.id !== deletedId);
    if (remaining.length > 0) {
      setSelectedCustomerId(remaining[0].id);
    } else {
      setSelectedCustomerId('');
    }
  }, [selectedCustomer, customers, onDeleteCustomer]);

  const handleToggleFav = useCallback(() => {
    if (selectedCustomer) onToggleFavorite(selectedCustomer.id);
  }, [selectedCustomer, onToggleFavorite]);

  const handlePaneTopup = useCallback(() => {
    if (selectedCustomer) onTriggerTopup(selectedCustomer.id);
  }, [selectedCustomer, onTriggerTopup]);

  const handlePaneNotesSave = useCallback((custId, text) => {
    onUpdateCustomerNotes(custId, text);
  }, [onUpdateCustomerNotes]);

   const handleCreateCustomerSubmit = async (e) => {
     e.preventDefault();
     const errors = validate(
       {
         name: newCustName,
         groupId: newCustGroupId,
         email: newCustEmail,
         phone: newCustPhone,
         company: newCustCompany,
         monthlySpend: newCustMonthlySpend,
       },
       {
         name: [required('Full corporate name is required'), maxLength(120)],
         groupId: maxLength(30, 'Group ID must be 30 characters or fewer'),
         email: [required('Email address is required'), email()],
         phone: phone(),
         company: [required('Company name is required'), maxLength(120)],
         monthlySpend: positiveNumber('Monthly spend must be greater than 0'),
       },
     );
     if (hasErrors(errors)) {
       setAddFormErrors(errors);
       return;
     }

     let groupId = newCustGroupId.trim();
     if (groupId && !groupIdIsUnique(groupId)) {
       setAddFormErrors({ groupId: 'This Group ID is already in use. Pick another.' });
       return;
     }
     if (!groupId) {
       groupId = suggestUniqueGroupId(newCustName);
     }

     setAddFormErrors({});
     try {
       await onAddCustomer({
         name: newCustName,
         groupId: groupId,
         email: newCustEmail,
         phone: newCustPhone,
         companyName: newCustCompany,
         status: 'Active',
         creditLimitUSD: Number(newCustMonthlySpend)
       });
       // Only reset and close the modal once the customer was actually persisted.
       setNewCustName('');
       setNewCustGroupId('');
       setNewCustEmail('');
       setNewCustPhone('');
       setNewCustCompany('');
       setNewCustMonthlySpend(1000);
       setShowAddModal(false);
     } catch {
       // The error toast is raised by the hook (useCustomers.addCustomer).
       // Keep the modal open so the user can correct and retry.
     }
   };

  const handleOpenEditModal = useCallback(() => {
    if (selectedCustomer) {
      setEditCustData({ ...selectedCustomer });
      setShowEditModal(true);
    }
  }, [selectedCustomer]);

  const handleSaveEditCustomer = (e) => {
    e.preventDefault();
    if (!editCustData || !onUpdateCustomer) return;
    const errors = validate(
      {
        name: editCustData.name,
        groupId: editCustData.groupId,
        email: editCustData.email,
        phone: editCustData.phone,
        company: editCustData.companyName,
        credit: editCustData.creditLimitUSD,
      },
      {
        name: [required('Full corporate name is required'), maxLength(120)],
        groupId: [required('Group ID is required'), maxLength(30)],
        email: [required('Email address is required'), email()],
        phone: phone(),
        company: [required('Company name is required'), maxLength(120)],
        credit: positiveNumber('Credit limit must be greater than 0'),
      },
    );
    if (hasErrors(errors)) {
      setEditFormErrors(errors);
      return;
    }
    if (!groupIdIsUnique(editCustData.groupId, editCustData.id)) {
      setEditFormErrors({ groupId: 'This Group ID is already in use by another customer.' });
      return;
    }
    setEditFormErrors({});
    const payload = { ...editCustData };
    setShowEditModal(false);
    onUpdateCustomer(payload).catch(() => {});
  };

  return (
    <div className="space-y-5 sm:space-y-6 animate-fade-in" id="customers-view">
      <ErrorBanner error={error} onRetry={onRetry} />
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Customer CRM Hub</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage accounts, credit limits, topups, and active inventory allocations.</p>
        </div>
        <div>
          <button 
            id="btn-add-customer"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-brand-orange hover:bg-brand-orange-dark active:scale-95 transition-all text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm cursor-pointer whitespace-nowrap"
          >
            <UserPlus size={14} /> Add Corporate Customer
          </button>
        </div>
      </div>

      {/* Top Metrics Report Section */}
      <section id="customers-metrics" aria-label="Customer metrics report">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          <SummaryCard
            id="metric-total-users"
            label="Total Users"
            value={customerMetrics.totalUsers}
            subtext="All registered users on the platform"
            variant="blue"
            loading={customerMetrics.loading}
          />
          <SummaryCard
            id="metric-total-active-users"
            label="Total Active Users"
            value={customerMetrics.activeUsers}
            subtext="Currently active or engaged accounts"
            variant="emerald"
            loading={customerMetrics.loading}
          />
          <SummaryCard
            id="metric-total-favorite-users"
            label="Total Favorite Users"
            value={customerMetrics.favoriteUsers}
            subtext="Users marked as favorite or starred"
            variant="amber"
            loading={customerMetrics.loading}
          />
        </div>
      </section>

      {/* Split master-detail layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Left column: Master list (span 5) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          
          {/* Header controls */}
          <div className="p-3 sm:p-3.5 border-b border-slate-100 dark:border-slate-800 space-y-2.5 bg-white dark:bg-slate-900">
            <div className="relative">
              <input
                id="customer-search"
                type="text"
                placeholder="Search by name, company, email, group or customer ID..."
                value={searchTerm}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
              />
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <select
                  id="status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-blue cursor-pointer transition-colors ${
                    statusFilter === 'Active' 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <option value="All" className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 font-medium">
                    All Statuses
                  </option>
                  <option value="Active" className="text-emerald-600 dark:text-emerald-400 font-bold bg-white dark:bg-slate-900">
                    Active
                  </option>
                </select>
              </div>

              <button
                id="filter-favorites"
                onClick={() => setFavoriteFilter(!favoriteFilter)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-md font-semibold border transition-all cursor-pointer ${
                  favoriteFilter 
                    ? 'bg-amber-500 text-white border-amber-500' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                <Star size={10} className={favoriteFilter ? 'fill-white' : ''} /> Favorites Only
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] overflow-y-auto" id="customers-list-box">
            {loading && filteredCustomers.length === 0 ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="p-3 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-6 w-6 rounded-md bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-2.5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <div className="h-2.5 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-2 w-14 rounded bg-slate-100 dark:bg-slate-800 ml-auto" />
                  </div>
                </div>
              ))
            ) : filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                <Filter size={20} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">No matching customers found.</p>
              </div>
            ) : (
              pagedCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <CustomerRow
                    key={cust.id}
                    cust={cust}
                    isSelected={isSelected}
                    stats={getCustomerStats(cust.id)}
                    onSelect={handleSelectCustomer}
                  />
                );
              })
            )}
            <Pagination page={customerPage} totalPages={customerTotalPages} onPageChange={setCustomerPage} />
          </div>
        </div>

        {/* Right column: Detailed Profile view (span 7) */}
        {(!selectedCustomer && loading) ? (
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-pulse">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="h-2 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-6 w-14 rounded-md bg-slate-200 dark:bg-slate-700" />
                  <div className="h-6 w-16 rounded-md bg-slate-200 dark:bg-slate-700" />
                  <div className="h-6 w-24 rounded-md bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
              <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-100 dark:bg-slate-800">
                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-2 w-20 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-24 rounded bg-slate-300 dark:bg-slate-600" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : selectedCustomer ? (
          <CustomerDetailsPane
            key={selectedCustomer.id}
            customer={selectedCustomer}
            stats={getCustomerStats(selectedCustomer.id)}
            onToggleFavorite={handleToggleFav}
            onTopup={handlePaneTopup}
            onEdit={handleOpenEditModal}
            onRequestAssign={handleOpenAssignModal}
            onDelete={handleRequestDelete}
            onNotesSave={handlePaneNotesSave}
            onUnassignAdAccount={handlePaneUnassign}
            onConfigureSaleSetup={onConfigureSaleSetup}
            setups={setups}
          />
        ) : null}

      </div>

      {/* Customer creation Modal dialog */}
      <Modal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setAddFormErrors({}); }}
        title="Create New Corporate Customer"
        description="Add details to populate client record and grant agency ad accounts."
        size="md"
        variant="animated"
        showCloseButton={false}
      >
        <form onSubmit={handleCreateCustomerSubmit} className="p-6 space-y-4" id="form-add-customer">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Full Corporate Name</label>
            <input
              id="new-cust-name"
              type="text"
              required
              placeholder="e.g. Bijoy Group Ltd"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newCustName}
              onChange={(e) => { setNewCustName(e.target.value); if (addFormErrors.name) setAddFormErrors((p) => ({ ...p, name: undefined })); }}
            />
            <FieldError error={addFormErrors.name} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Group ID</label>
              <input
                id="new-cust-group-id"
                type="text"
                placeholder={newCustName ? `e.g. ${suggestUniqueGroupId(newCustName)}` : "e.g. GC-BIJOY"}
                className={`w-full text-xs p-2.5 border ${newCustGroupId && !groupIdIsUnique(newCustGroupId) ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 ${newCustGroupId && !groupIdIsUnique(newCustGroupId) ? 'focus:ring-red-500' : 'focus:ring-blue-500'} dark:text-slate-100 font-mono`}
                value={newCustGroupId}
                onChange={(e) => { setNewCustGroupId(e.target.value); if (addFormErrors.groupId) setAddFormErrors((p) => ({ ...p, groupId: undefined })); }}
              />
              {newCustGroupId && !groupIdIsUnique(newCustGroupId) && (
                <p className="mt-0.5 text-[10px] text-red-500 font-semibold">This Group ID is already taken.</p>
              )}
              <FieldError error={addFormErrors.groupId} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Brand / Company Name</label>
              <input
                id="new-cust-company"
                type="text"
                required
                placeholder="e.g. Bijoy E-Commerce"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newCustCompany}
                onChange={(e) => setNewCustCompany(e.target.value)}
              />
              <FieldError error={addFormErrors.company} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                id="new-cust-email"
                type="email"
                required
                placeholder="e.g. support@bijoy.com"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newCustEmail}
                onChange={(e) => setNewCustEmail(e.target.value)}
              />
              <FieldError error={addFormErrors.email} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                id="new-cust-phone"
                type="text"
                placeholder="e.g. +880 1711..."
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
              />
              <FieldError error={addFormErrors.phone} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Monthly Spend (USD)</label>
            <input
              id="new-cust-monthly-spend"
              type="number"
              placeholder="e.g. 5000"
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={newCustMonthlySpend}
              onChange={(e) => setNewCustMonthlySpend(Number(e.target.value))}
            />
            <FieldError error={addFormErrors.monthlySpend} />
          </div>
          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button type="submit">Save Customer</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Customer Modal Dialog */}
      <Modal
        isOpen={showEditModal && !!editCustData}
        onClose={() => { setShowEditModal(false); setEditFormErrors({}); }}
        title="Edit Corporate Customer Record"
        description={editCustData ? `Modify parameters for ${editCustData.name} (${editCustData.id})` : undefined}
        size="lg"
        variant="animated"
        showCloseButton={false}
      >
        <form onSubmit={handleSaveEditCustomer} className="p-6 space-y-4" id="form-edit-customer">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Full Corporate Name</label>
            <input
              id="edit-cust-name"
              type="text"
              required
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCustData?.name ?? ''}
              onChange={(e) => editCustData && setEditCustData({ ...editCustData, name: e.target.value })}
            />
            <FieldError error={editFormErrors.name} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Group ID</label>
              <input
                id="edit-cust-group-id"
                type="text"
                required
                className={`w-full text-xs p-2.5 border ${editCustData?.groupId && !groupIdIsUnique(editCustData.groupId, editCustData.id) ? 'border-red-400 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 ${editCustData?.groupId && !groupIdIsUnique(editCustData.groupId, editCustData.id) ? 'focus:ring-red-500' : 'focus:ring-blue-500'} dark:text-slate-100 font-mono`}
                value={editCustData?.groupId || ''}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, groupId: e.target.value })}
              />
              {editCustData?.groupId && !groupIdIsUnique(editCustData.groupId, editCustData.id) && (
                <p className="mt-0.5 text-[10px] text-red-500 font-semibold">This Group ID is already taken by another customer.</p>
              )}
              <FieldError error={editFormErrors.groupId} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Brand / Company Name</label>
              <input
                id="edit-cust-company"
                type="text"
                required
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editCustData?.companyName ?? ''}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, companyName: e.target.value })}
              />
              <FieldError error={editFormErrors.company} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input
                id="edit-cust-email"
                type="email"
                required
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editCustData?.email ?? ''}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, email: e.target.value })}
              />
              <FieldError error={editFormErrors.email} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Phone Number</label>
              <input
                id="edit-cust-phone"
                type="text"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editCustData?.phone ?? ''}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, phone: e.target.value })}
              />
              <FieldError error={editFormErrors.phone} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Credit Limit (USD)</label>
              <input
                id="edit-cust-credit"
                type="number"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
                value={editCustData?.creditLimitUSD ?? 0}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, creditLimitUSD: Number(e.target.value) })}
              />
              <FieldError error={editFormErrors.credit} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Account Status</label>
              <select
                id="edit-cust-status"
                className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100 font-bold"
                value={editCustData?.status ?? 'Active'}
                onChange={(e) => editCustData && setEditCustData({ ...editCustData, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">CRM Relationship Notes</label>
            <textarea
              id="edit-cust-notes"
              rows={3}
              className="w-full text-xs p-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 dark:text-slate-100"
              value={editCustData?.notes || ''}
              onChange={(e) => editCustData && setEditCustData({ ...editCustData, notes: e.target.value })}
            />
          </div>

          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Assign Ad Account Modal */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => { setShowAssignModal(false); setAssignTargetAccountId(''); setAssignSearchTerm(''); }}
        title="Assign Ad Account"
        description={selectedCustomer ? `Allocate an available ad account to ${selectedCustomer.name}` : undefined}
        size="md"
        variant="animated"
      >
        <div className="p-6 space-y-4">
          {assignableAdAccounts.length === 0 ? (
            <div className="py-10 text-center text-slate-400 dark:text-slate-500 border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
              <Layers className="mx-auto mb-2 opacity-40" size={28} />
              <p className="text-xs">No unassigned ad accounts are available.</p>
              <p className="text-[10px] mt-1">Load new accounts from the Ad Account Inventory or free up existing ones.</p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Search Ad Account</label>
                <div className="relative">
                  <input
                    id="assign-account-search"
                    type="text"
                    placeholder="Search by name or ID..."
                    value={assignSearchTerm}
                    onChange={(e) => setAssignSearchTerm(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-blue dark:text-slate-100 placeholder:text-slate-400"
                  />
                  <Search className="absolute left-2.5 top-2.5 text-slate-400" size={13} />
                </div>
              </div>

              <div className="max-h-56 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                {assignableAdAccounts
                  .filter((acc) => {
                    if (!assignSearchTerm.trim()) return true;
                    const q = assignSearchTerm.toLowerCase();
                    const nameMatch = (acc.adAccountName || '').toLowerCase().includes(q);
                    const idMatch = (acc.adAccountId || '').toLowerCase().includes(q);
                    const platformMatch = (acc.platform || '').toLowerCase().includes(q);
                    return nameMatch || idMatch || platformMatch;
                  })
                  .map((acc) => {
                    const isSelected = assignTargetAccountId === acc.adAccountId;
                    return (
                      <div
                        key={acc._id || acc.adAccountId}
                        onClick={() => setAssignTargetAccountId(acc.adAccountId)}
                        className={`p-2.5 cursor-pointer transition-all border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                          isSelected
                            ? 'bg-brand-blue/10 border-brand-blue dark:bg-blue-900/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${isSelected ? 'text-brand-blue' : 'text-slate-800 dark:text-slate-200'}`}>{acc.adAccountName}</p>
                            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-400">ID: {acc.adAccountId}</p>
                          </div>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            acc.accountStatus === 'Active'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-100 dark:text-emerald-100'
                              : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-100 dark:text-emerald-100'
                          }`}>
                            {acc.platform}
                          </span>
                        </div>
                        {isSelected && (
                          <p className="mt-1 text-[10px] text-brand-blue font-semibold">Selected</p>
                        )}
                      </div>
                    );
                  })}
                {assignSearchTerm.trim() && assignableAdAccounts.filter((acc) => {
                  const q = assignSearchTerm.toLowerCase();
                  return (
                    (acc.adAccountName || '').toLowerCase().includes(q) ||
                    (acc.adAccountId || '').toLowerCase().includes(q) ||
                    (acc.platform || '').toLowerCase().includes(q)
                  );
                }).length === 0 && (
                  <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                    No matching ad accounts found.
                  </div>
                )}
              </div>

              {assignTargetAccountId && (
                <div className="p-3 rounded-xl bg-surface-blue-light dark:bg-surface-blue-light border border-border-blue-light dark:border-border-blue-light text-xs text-brand-blue-deep dark:text-brand-blue-deep">
                  {(() => {
                    const acc = assignableAdAccounts.find(a => a.adAccountId === assignTargetAccountId);
                    if (!acc) return null;
                    return (
                      <div className="space-y-1">
                        <p className="font-bold">{acc.adAccountName}</p>
                        <p>Platform: <span className="font-semibold">{acc.platform}</span> · Rate: <span className="font-semibold">৳{acc.dollarRate}</span></p>
                        <p>Monthly Spend: <span className="font-semibold">${(acc.monthlySpending || 0).toLocaleString()}</span></p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </>
          )}
          <div className="custom-modal-footer flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => { setShowAssignModal(false); setAssignTargetAccountId(''); setAssignSearchTerm(''); }}>Cancel</Button>
            <Button
              type="button"
              onClick={handleConfirmAssign}
              disabled={!assignTargetAccountId || assigning || assignableAdAccounts.length === 0}
              // leftIcon={<Layers size={12} />}
            >
              {assigning ? 'Assigning...' : 'Assign Account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Customer Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Customer?"
        message={`This will permanently remove ${selectedCustomer?.name} (${selectedCustomer?.id}) and its profile record from the CRM. This action cannot be undone.`}
        confirmLabel="Delete Customer"
        variant="danger"
      />

    </div>
  );
}

export default memo(CustomersView);

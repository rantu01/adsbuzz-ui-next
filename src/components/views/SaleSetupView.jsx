'use client';

import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, FileEdit, ChevronLeft, ChevronRight } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchBar from '@/components/ui/SearchBar';

const SETUP_TYPE_OPTIONS = [
  { value: 'Ad Account Sales Setup', label: 'Ad Account Sales Setup' },
  { value: 'Others Sale Setup', label: 'Others Sale Setup' },
];

const STATUS_OPTIONS = ['Active', 'Terminated', 'Replace'];

// Reusable searchable select — keyboard navigable, auto-closes on select
function SearchableSelect({
  options, value, onChange, placeholder, disabled, emptyText = 'No options'
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    (o.sub || '').toLowerCase().includes(query.toLowerCase())
  );

  // If a value is set, always display something meaningful instead of "Select..."
  const selected = options.find(o => o.value === value) || (value ? { value, label: String(value) } : null);

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIdx]) { onChange(filtered[activeIdx].value); setOpen(false); setQuery(''); }
    } else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(o => !o); }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={selected ? selected.label : (placeholder || 'Select')}
        className={`w-full text-xs p-2 text-left rounded-lg border flex items-center justify-between font-mono font-semibold ${
          disabled
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
            : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <span className="truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              <span>{selected.label}</span>
              {selected.sub && <span className="text-[10px] text-slate-400 font-sans font-normal">{selected.sub}</span>}
            </span>
          ) : (
            <span className="text-slate-400 font-sans font-normal">{placeholder || 'Select...'}</span>
          )}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-label={placeholder || 'Select'} className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
              className="w-full text-xs px-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-sans"
            />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-[11px] text-slate-400 italic">{emptyText}</div>
            ) : (
              filtered.map((opt, idx) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); setQuery(''); }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between ${
                    idx === activeIdx ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  } ${value === opt.value ? 'bg-blue-100/50 dark:bg-blue-900/30' : ''}`}
                >
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{opt.label}</span>
                  {opt.sub && <span className="text-[10px] text-slate-400 ml-2">{opt.sub}</span>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SaleSetupView({
  setups,
  customers,
  socialAdAccounts = [],
  onAddSetup,
  onUpdateSetup,
  customersLoading,
  adAccountsLoading,
  prefill = null,
  onPrefillConsumed,
}) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Add-form state
  const [form, setForm] = useState({
    groupId: '',
    serviceType: 'Ad Account Sales Setup',
    adAccountId: '',
    dollarRate: '',
    monthlySpending: '',
    service: '',
    serviceDetails: '',
    serviceFee: '',
    status: 'Active',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Edit-form state
  const [editSetupData, setEditSetupData] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Group ID options: derived from all customers (Active and Inactive) with a groupId set
  const groupIdOptions = customers
    .filter(c => !!c.groupId)
    .map(c => ({ value: c.groupId, label: c.groupId, sub: c.name }));

  // ---- Add-form derived values ----
  const allAccounts = useMemo(() => [...(socialAdAccounts || [])], [socialAdAccounts]);

  const addCustomer = customers.find(c => c.groupId === form.groupId);
  const addCustomerAccounts = addCustomer
    ? allAccounts.filter(a =>
        a.assignedCustomer === addCustomer.id ||
        (a.userGroupCode && addCustomer.groupId === a.userGroupCode),
      )
    : [];

  // Accounts that already have an ACTIVE Sale Setup configured. Only accounts that
  // do NOT yet have an active setup are offered when creating a new Sale Setup
  // entry. Terminated (unassigned) or replaced setups remain for history but do
  // not block creating a fresh setup for the same account + group.
  const configuredAccountIds = useMemo(
    () =>
      new Set(
        (setups || [])
          .filter((s) => s.serviceType === 'Ad Account Sales Setup' && s.adAccountId && s.status === 'Active')
          .map((s) => s.adAccountId),
      ),
    [setups],
  );

  const addAccountOptions = addCustomerAccounts
    .filter(a => !configuredAccountIds.has(a.adAccountId))
    .map(a => ({
    value: a.adAccountId,
    label: a.adAccountName,
    sub: `${a.adAccountId} • ${a.platform}`
  }));
  // When navigating here from "Configure in Sale Setup", make sure the pre-filled
  // ad account is always selectable even if a (e.g. terminated) setup already exists.
  if (prefill?.adAccountId && !addAccountOptions.some(o => o.value === prefill.adAccountId)) {
    const prefilledAccount = addCustomerAccounts.find(a => a.adAccountId === prefill.adAccountId)
      || allAccounts.find(a => a.adAccountId === prefill.adAccountId);
    if (prefilledAccount) {
      addAccountOptions.push({
        value: prefilledAccount.adAccountId,
        label: prefilledAccount.adAccountName,
        sub: `${prefilledAccount.adAccountId} • ${prefilledAccount.platform}`,
      });
    }
  }
  const addSelectedAccount = addCustomerAccounts.find(a => a.adAccountId === form.adAccountId);
  const isAddOthers = form.serviceType === 'Others Sale Setup';

  // ---- Edit-form derived values ----
  const isEditOthers = ['Others', 'Others Sale Setup'].includes(editSetupData?.serviceType);
  const editCustomer = editSetupData
    ? customers.find(c => c.groupId === editSetupData.groupId)
    : null;
  const editCustomerAccounts = editCustomer
    ? allAccounts.filter(a =>
        a.assignedCustomer === editCustomer.id ||
        (a.userGroupCode && editCustomer.groupId === a.userGroupCode),
      )
    : [];

  let editAccountOptions = editCustomerAccounts.map(a => ({
    value: a.adAccountId,
    label: a.adAccountName,
    sub: `${a.adAccountId} • ${a.platform}`
  }));
  // Always keep the currently saved ad account selectable so it renders correctly.
  if (editSetupData?.adAccountId && !editAccountOptions.some(o => o.value === editSetupData.adAccountId)) {
    const current = socialAdAccounts.find(a => a.adAccountId === editSetupData.adAccountId);
    editAccountOptions = [
      ...editAccountOptions,
      current
        ? { value: current.adAccountId, label: current.adAccountName, sub: `${current.adAccountId} • ${current.platform}` }
        : { value: editSetupData.adAccountId, label: editSetupData.adAccountId, sub: editSetupData.adAccountId },
    ];
  }
  const filtered = (setups || []).filter(s =>
    String(s.adName || '').toLowerCase().includes(search.toLowerCase()) ||
    String(s.groupId || '').toLowerCase().includes(search.toLowerCase())
  );

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
  }, [search]);

  const resetForm = () => {
    setForm({
      groupId: '',
      serviceType: 'Ad Account Sales Setup',
      adAccountId: '',
      dollarRate: '',
      monthlySpending: '',
      service: '',
      serviceDetails: '',
      serviceFee: '',
      status: 'Active',
    });
    setFormErrors({});
    setSubmitting(false);
  };

  const clearAddError = (key) => {
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const clearEditError = (key) => {
    if (editErrors[key]) setEditErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleGroupIdChange = (gid) => {
    setForm(prev => ({ ...prev, groupId: gid, adAccountId: '', dollarRate: '', monthlySpending: '' }));
    clearAddError('groupId');
    clearAddError('adAccountId');
  };

  const handleAdAccountChange = (accId) => {
    const a = allAccounts.find(x => x.adAccountId === accId);
    setForm(prev => ({
      ...prev,
      adAccountId: accId,
      dollarRate: a?.dollarRate ?? prev.dollarRate,
      monthlySpending: a?.monthlySpending ?? prev.monthlySpending,
    }));
    clearAddError('adAccountId');
  };

  const handleEditAdAccountChange = (accId) => {
    const a = allAccounts.find(x => x.adAccountId === accId);
    setEditSetupData(prev => ({
      ...prev,
      adAccountId: accId,
      adName: a?.adAccountName || prev.adName,
      platform: a?.platform || prev.platform,
      dollarRate: a?.dollarRate ?? prev.dollarRate,
      monthlySpending: a?.monthlySpending ?? prev.monthlySpending,
    }));
    clearEditError('adAccountId');
  };

  const buildPayload = () => {
    if (!form.groupId) return null;
    if (isAddOthers) {
      if (!form.service.trim() || !form.serviceDetails.trim() || Number(form.serviceFee) <= 0) return null;
      const service = form.service.trim();
      return {
        groupId: form.groupId,
        serviceType: 'Others Sale Setup',
        service,
        serviceDetails: form.serviceDetails.trim(),
        serviceFee: Number(form.serviceFee),
        adName: service,
        status: form.status,
      };
    }
    if (!form.adAccountId) return null;
    const a = addSelectedAccount || allAccounts.find(x => x.adAccountId === form.adAccountId);
    if (!a) return null;
    return {
      groupId: form.groupId,
      serviceType: 'Ad Account Sales Setup',
      adAccountId: form.adAccountId,
      adName: a.adAccountName,
      platform: a.platform,
      dollarRate: Number(form.dollarRate) > 0 ? Number(form.dollarRate) : a.dollarRate,
      monthlySpending: Number(form.monthlySpending) > 0 ? Number(form.monthlySpending) : a.monthlySpending,
      status: form.status,
    };
  };

  const validateAddForm = () => {
    const errors = {};
    if (!form.groupId) errors.groupId = 'Select a Group ID code.';
    if (isAddOthers) {
      if (!form.service.trim()) errors.service = 'Enter the service.';
      if (!form.serviceDetails.trim()) errors.serviceDetails = 'Enter service details.';
      if (Number(form.serviceFee) <= 0) errors.serviceFee = 'Enter a valid service fee.';
    } else {
      if (!form.adAccountId) errors.adAccountId = 'Select an ad account for this customer.';
      if (Number(form.dollarRate) <= 0) errors.dollarRate = 'Enter a valid dollar rate.';
      if (Number(form.monthlySpending) <= 0) errors.monthlySpending = 'Enter a valid monthly spending.';
    }
    return errors;
  };

  const validateEditForm = () => {
    if (!editSetupData) return {};
    const errors = {};
    if (isEditOthers) {
      if (!String(editSetupData.service || '').trim()) errors.service = 'Enter the service.';
      if (!String(editSetupData.serviceDetails || '').trim()) errors.serviceDetails = 'Enter service details.';
      if (Number(editSetupData.serviceFee) <= 0) errors.serviceFee = 'Enter a valid service fee.';
    } else {
      if (!editSetupData.adAccountId) errors.adAccountId = 'Select an ad account for this customer.';
      if (Number(editSetupData.dollarRate) <= 0) errors.dollarRate = 'Enter a valid dollar rate.';
      if (Number(editSetupData.monthlySpending) <= 0) errors.monthlySpending = 'Enter a valid monthly spending.';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateAddForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      await onAddSetup(payload);
      resetForm();
      setShowModal(false);
    } catch (err) {
      // Failure toast is already shown by the hook — keep the modal open so the
      // user can correct their input instead of losing it.
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editSetupData) return;
    const errors = validateEditForm();
    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEditSubmitting(true);
    try {
      await onUpdateSetup(editSetupData);
      setShowEditModal(false);
      setEditSetupData(null);
    } catch (err) {
      // Failure toast is already shown by the hook — keep the modal open.
    } finally {
      setEditSubmitting(false);
    }
  };

  const openEditModal = (s) => {
    setEditSetupData({ ...s });
    setEditErrors({});
    setEditSubmitting(false);
    setShowEditModal(true);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Cross-view prefill: when the user clicks "Configure in Sale Setup" on the
  // customer profile, navigate here with the customer + ad account intent and
  // auto-open the New Sale Setup modal pre-filled with that group + account.
  const prefillHandledRef = useRef(false);
  useEffect(() => {
    if (!prefill || prefillHandledRef.current) return;
    if (customersLoading || adAccountsLoading) return;
    const customer = customers.find(c => c.id === prefill.customerId);
    if (!customer) return;
    const account = allAccounts.find(a => a.adAccountId === prefill.adAccountId);
    prefillHandledRef.current = true;
    resetForm();
    setForm(prev => ({
      ...prev,
      groupId: customer.groupId || '',
      serviceType: 'Ad Account Sales Setup',
      adAccountId: prefill.adAccountId || '',
      dollarRate: account?.dollarRate ?? prev.dollarRate,
      monthlySpending: account?.monthlySpending ?? prev.monthlySpending,
    }));
    setShowModal(true);
    onPrefillConsumed?.();
  }, [prefill, customers, allAccounts, customersLoading, adAccountsLoading, onPrefillConsumed]);

  // ---- Shared form renderer for Add / Edit ----
  const renderForm = (isEdit) => {
    const errors = isEdit ? editErrors : formErrors;
    const data = isEdit ? editSetupData : form;
    const isOthers = isEdit ? isEditOthers : isAddOthers;

    const groupId = data?.groupId || '';
    const serviceType = data?.serviceType || 'Ad Account Sales Setup';
    const status = STATUS_OPTIONS.includes(data?.status) ? data.status : (data?.status || 'Active');
    const adAccountId = data?.adAccountId || '';
    const service = data?.service || '';
    const serviceDetails = data?.serviceDetails || '';
    const serviceFee = data?.serviceFee ?? '';

    const customer = isEdit ? editCustomer : addCustomer;
    const accountOptions = isEdit ? editAccountOptions : addAccountOptions;
    const accountSelectDisabled = isEdit
      ? (!editCustomer && !adAccountId)
      : (!addCustomer || adAccountsLoading);

    const rate = data?.dollarRate ?? addSelectedAccount?.dollarRate ?? '';
    const spend = data?.monthlySpending ?? addSelectedAccount?.monthlySpending ?? '';

    return (
      <form
        onSubmit={isEdit ? handleEditSubmit : handleSubmit}
        className="space-y-4"
        id={isEdit ? 'form-edit-setup' : 'form-add-setup'}
      >
        {/* Row 1: Group ID (searchable) + Customer (auto) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Select Group ID</label>
            {isEdit ? (
              <input
                type="text"
                value={groupId}
                readOnly
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono cursor-not-allowed"
              />
            ) : (
              <>
                <SearchableSelect
                  options={groupIdOptions}
                  value={groupId}
                  onChange={handleGroupIdChange}
                  placeholder={customersLoading ? 'Loading group IDs...' : 'Select Group ID...'}
                  emptyText={customersLoading ? 'Loading...' : 'No clients with Group ID found'}
                  disabled={customersLoading}
                />
                {errors.groupId && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.groupId}</p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer Information</label>
            <div className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
              {(() => {
                if (customersLoading && !customer) return <span className="text-slate-400 font-normal">Loading customers...</span>;
                return customer
                  ? `${customer.name} (${customer.companyName})`
                  : <span className="text-slate-400 font-normal">Select a Group ID first</span>;
              })()}
            </div>
          </div>
        </div>

        {/* Select Service Type */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Select Service Type</label>
          <select
            value={serviceType}
            disabled={isEdit}
            onChange={(e) => {
              setForm(prev => ({ ...prev, serviceType: e.target.value, adAccountId: '' }));
              clearAddError('adAccountId');
            }}
            className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium disabled:cursor-not-allowed disabled:opacity-70"
          >
            {SETUP_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Ad Account Sales Setup fields */}
        {!isOthers && (
          <>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Assign Ad Account</label>
              <SearchableSelect
                options={accountOptions}
                value={adAccountId}
                onChange={isEdit ? handleEditAdAccountChange : handleAdAccountChange}
                placeholder={isEdit ? 'Select ad account...' : (addCustomer ? (adAccountsLoading ? 'Loading ad accounts...' : 'Select ad account...') : 'Select a customer first')}
                disabled={accountSelectDisabled}
                emptyText={isEdit ? 'No ad accounts assigned to this customer' : 'No ad accounts available — assigned accounts already have a Sale Setup'}
              />
              {errors.adAccountId && (
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.adAccountId}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dollar Rate (৳)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(e) => {
                    if (isEdit) setEditSetupData(prev => ({ ...prev, dollarRate: Number(e.target.value) }));
                    else setForm(prev => ({ ...prev, dollarRate: Number(e.target.value) }));
                    if (isEdit) clearEditError('dollarRate'); else clearAddError('dollarRate');
                  }}
                  placeholder="Enter dollar rate"
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
                />
                {errors.dollarRate && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.dollarRate}</p>
                )}
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Monthly Spending ($)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={spend}
                  onChange={(e) => {
                    if (isEdit) setEditSetupData(prev => ({ ...prev, monthlySpending: Number(e.target.value) }));
                    else setForm(prev => ({ ...prev, monthlySpending: Number(e.target.value) }));
                    if (isEdit) clearEditError('monthlySpending'); else clearAddError('monthlySpending');
                  }}
                  placeholder="Enter monthly spending"
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
                />
                {errors.monthlySpending && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.monthlySpending}</p>
                )}
              </div>
            </div>
          </>
        )}

        {/* Others Sale Setup fields */}
        {isOthers && (
          <>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service</label>
              <input
                type="text"
                value={service}
                onChange={(e) => {
                  if (isEdit) setEditSetupData(prev => ({ ...prev, service: e.target.value }));
                  else setForm(prev => ({ ...prev, service: e.target.value }));
                  if (isEdit) clearEditError('service'); else clearAddError('service');
                }}
                placeholder="e.g. Creative Design, Landing Page..."
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
              {errors.service && (
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.service}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Details</label>
              <input
                type="text"
                value={serviceDetails}
                onChange={(e) => {
                  if (isEdit) setEditSetupData(prev => ({ ...prev, serviceDetails: e.target.value }));
                  else setForm(prev => ({ ...prev, serviceDetails: e.target.value }));
                  if (isEdit) clearEditError('serviceDetails'); else clearAddError('serviceDetails');
                }}
                placeholder="e.g. Monthly creative + landing page package"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
              {errors.serviceDetails && (
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.serviceDetails}</p>
              )}
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Fee (BDT ৳)</label>
              <input
                type="number"
                value={serviceFee}
                onChange={(e) => {
                  if (isEdit) setEditSetupData(prev => ({ ...prev, serviceFee: Number(e.target.value) }));
                  else setForm(prev => ({ ...prev, serviceFee: Number(e.target.value) }));
                  if (isEdit) clearEditError('serviceFee'); else clearAddError('serviceFee');
                }}
                placeholder="e.g. 5000"
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
              {errors.serviceFee && (
                <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{errors.serviceFee}</p>
              )}
            </div>
          </>
        )}

        {/* Status */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => {
              if (isEdit) setEditSetupData(prev => ({ ...prev, status: e.target.value }));
              else setForm(prev => ({ ...prev, status: e.target.value }));
            }}
            className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
            {!STATUS_OPTIONS.includes(data?.status) && data?.status && (
              <option value={data.status}>{data.status}</option>
            )}
          </select>
        </div>

        <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => isEdit ? setShowEditModal(false) : setShowModal(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isEdit ? editSubmitting : submitting}>
            {isEdit ? 'Save Changes' : (submitting ? 'Creating...' : 'Create')}
          </Button>
        </div>
      </form>
    );
  };

  const statusBadgeClass = (status) => {
    if (status === 'Active') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    if (status === 'Terminated') return 'bg-red-500/10 text-red-600 dark:text-red-400';
    if (status === 'Replace') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
    return 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Sale Setup</h1>
          <p className="text-sm text-slate-500">Assign Group IDs, ad accounts, and services with monthly spending limits.</p>
        </div>
        <Button
          id="btn-add-setup"
          onClick={openAddModal}
          leftIcon={<Plus size={14} />}
        >
          New Sale Setup
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <SearchBar
            showIcon={false}
            placeholder="Search by Ad Name or Group Code..."
            value={search}
            onChange={(value) => setSearch(value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/20 font-bold border-b border-slate-100 dark:border-slate-800 text-slate-500">
              <tr>
                <th scope="col" className="py-3.5 pl-4">Group Code</th>
                <th scope="col" className="py-3.5">Service</th>
                <th scope="col" className="py-3.5">Ad Name / Details</th>
                <th scope="col" className="py-3.5">Platform</th>
                <th scope="col" className="py-3.5 text-center">Rate</th>
                <th scope="col" className="py-3.5 text-right">Monthly / Fee</th>
                <th scope="col" className="py-3.5 text-center">Status</th>
                <th scope="col" className="py-3.5 pr-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginated.map((s, idx) => {
                const isOthers = ['Others', 'Others Sale Setup'].includes(s.serviceType);
                return (
                  <tr key={s.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-4 font-bold text-slate-800 dark:text-slate-200 font-mono">{s.groupId}</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                        isOthers
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                          : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                      }`}>
                        {isOthers ? 'Others' : 'Ad Account'}
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                      {isOthers ? (s.service || s.serviceDetails || s.adName) : s.adName}
                    </td>
                    <td className="py-3">{isOthers ? <span className="text-slate-400">—</span> : <PlatformText platform={s.platform} />}</td>
                    <td className="py-3 text-center font-bold">
                      {isOthers ? <span className="text-slate-400">—</span> : `৳${s.dollarRate}`}
                    </td>
                    <td className="py-3 text-right font-semibold">
                      {isOthers
                        ? <span className="text-amber-700 dark:text-amber-300">৳{(s.serviceFee || 0).toLocaleString()}</span>
                        : `$${s.monthlySpending}`}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block ${statusBadgeClass(s.status)}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(s)}
                        leftIcon={<FileEdit size={11} />}
                        className="ml-auto"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 italic">
                    No sale setups match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} setups
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
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      p === safePage
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

      {/* Add Sale Setup Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Sale Setup"
        size="md"
        showCloseButton={false}
      >
        {renderForm(false)}
      </Modal>

      {/* Edit Sale Setup Modal */}
      <Modal
        isOpen={showEditModal && !!editSetupData}
        onClose={() => setShowEditModal(false)}
        title="Edit Sale Setup"
        size="md"
        showCloseButton={false}
      >
        {renderForm(true)}
      </Modal>
    </div>
  );
}

export default memo(SaleSetupView);

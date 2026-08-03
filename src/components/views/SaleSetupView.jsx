'use client';

import React, { memo, useState } from 'react';
import { Plus, FileEdit } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchBar from '@/components/ui/SearchBar';

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

  const selected = options.find(o => o.value === value);

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

function SaleSetupView({ setups, customers, adAccounts, onAddSetup, onUpdateSetup, customersLoading, adAccountsLoading }) {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Add-form state
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formGroupId, setFormGroupId] = useState('');
  const [formUserId, setFormUserId] = useState('USER-NEW');
  const [formServiceType, setFormServiceType] = useState('Ad Account Topup');
  const [formAdAccountId, setFormAdAccountId] = useState('');
  const [formAdName, setFormAdName] = useState('');
  const [formServiceDetails, setFormServiceDetails] = useState('');
  const [formServiceFee, setFormServiceFee] = useState(0);
  const [formStatus, setFormStatus] = useState('Active');
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [editSetupData, setEditSetupData] = useState(null);

  // Only Active customers
  const activeCustomers = customers.filter(c => c.status === 'Active');

  // Group ID options: derived from active customers with a groupId set
  const groupIdOptions = activeCustomers
    .filter(c => !!c.groupId)
    .map(c => ({ value: c.groupId, label: c.groupId, sub: c.name }));

  // Ad accounts belonging to selected customer (Add form)
  const formCustomerAdAccounts = formCustomerId
    ? adAccounts.filter(a => a.assignedCustomer === formCustomerId)
    : [];
  const adAccountOptions = formCustomerAdAccounts.map(a => ({
    value: a.adAccountId,
    label: a.adAccountName,
    sub: `${a.adAccountId} • ${a.platform}`
  }));
  const selectedAdAccount = formCustomerAdAccounts.find(a => a.adAccountId === formAdAccountId);
  const derivedRate = selectedAdAccount?.dollarRate ?? 132;
  const derivedSpend = selectedAdAccount?.monthlySpending ?? 0;

  const filtered = setups.filter(s =>
    s.adName.toLowerCase().includes(search.toLowerCase()) ||
    s.groupId.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormCustomerId('');
    setFormGroupId('');
    setFormUserId('USER-NEW');
    setFormServiceType('Ad Account Topup');
    setFormAdAccountId('');
    setFormAdName('');
    setFormServiceDetails('');
    setFormServiceFee(0);
    setFormStatus('Active');
    setFormErrors({});
    setSubmitting(false);
  };

  const clearError = (key) => {
    if (formErrors[key]) setFormErrors(prev => ({ ...prev, [key]: undefined }));
  };

  const handleGroupIdChange = (gid) => {
    setFormGroupId(gid);
    clearError('groupId');
    const c = activeCustomers.find(x => x.groupId === gid);
    if (c) {
      setFormCustomerId(c.id);
      setFormAdAccountId('');
      setFormAdName('');
      clearError('adAccountId');
    }
  };

  const handleAdAccountChange = (accId) => {
    setFormAdAccountId(accId);
    clearError('adAccountId');
    const a = adAccounts.find(x => x.adAccountId === accId);
    if (a) setFormAdName(a.adAccountName);
  };

  const buildPayload = () => {
    if (!formGroupId) return null;
    if (formServiceType === 'Ad Account Topup') {
      if (!formAdAccountId) return null;
      const a = adAccounts.find(x => x.adAccountId === formAdAccountId);
      if (!a) return null;
      return {
        groupId: formGroupId,
        userId: formUserId,
        adName: formAdName || a.adAccountName,
        adAccountId: formAdAccountId,
        platform: a.platform,
        dollarRate: a.dollarRate,
        monthlySpending: a.monthlySpending,
        status: formStatus,
        serviceType: 'Ad Account Topup'
      };
    } else {
      if (!formServiceDetails || !formServiceFee) return null;
      return {
        groupId: formGroupId,
        userId: formUserId,
        adName: formServiceDetails,
        adAccountId: '',
        platform: 'Facebook',
        dollarRate: 0,
        monthlySpending: 0,
        status: formStatus,
        serviceType: 'Others',
        serviceDetails: formServiceDetails,
        serviceFee: Number(formServiceFee)
      };
    }
  };

  const validateAddForm = () => {
    const errors = {};
    if (!formGroupId) errors.groupId = 'Select a Group ID code.';
    if (formServiceType === 'Ad Account Topup' && !formAdAccountId) errors.adAccountId = 'Select an ad account for this customer.';
    if (formServiceType === 'Others' && !formServiceDetails.trim()) errors.serviceDetails = 'Enter service details.';
    if (formServiceType === 'Others' && Number(formServiceFee) <= 0) errors.serviceFee = 'Enter a valid service fee.';
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

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editSetupData) return;
    if (onUpdateSetup) {
      onUpdateSetup(editSetupData);
    }
    setShowEditModal(false);
    setEditSetupData(null);
  };

  const openEditModal = (s) => {
    setEditSetupData({ ...s });
    setShowEditModal(true);
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Determine customer ID for edit-form (derive from groupId)
  const getEditCustomerId = (s) => {
    if (!s) return '';
    const c = customers.find(x => x.groupId === s.groupId);
    return c?.id || '';
  };

  // ---- Shared form renderer for Add / Edit ----
  const renderForm = (
    data,
    setData,
    isEdit
  ) => {
    const isOthers = isEdit
      ? data?.serviceType === 'Others'
      : formServiceType === 'Others';

    const eCustomerId = isEdit ? getEditCustomerId(data) : formCustomerId;
    const eGroupId = isEdit ? (data?.groupId || '') : formGroupId;
    const eAdAccountId = isEdit ? (data?.adAccountId || '') : formAdAccountId;
    const eServiceDetails = isEdit ? (data?.serviceDetails || '') : formServiceDetails;
    const eServiceFee = isEdit ? (data?.serviceFee || 0) : formServiceFee;

    // Ad accounts filtered by customer (for edit, look up by groupId)
    const eCustomerAdAccounts = eCustomerId
      ? adAccounts.filter(a => a.assignedCustomer === eCustomerId)
      : adAccounts.filter(a => a.adAccountId === eAdAccountId); // fallback: at least show current acc

    const eAdAccountOptions = eCustomerAdAccounts.map(a => ({
      value: a.adAccountId,
      label: a.adAccountName,
      sub: `${a.adAccountId} • ${a.platform}`
    }));

    const editSelectedAcc = eCustomerAdAccounts.find(a => a.adAccountId === eAdAccountId);
    const eRateVal = editSelectedAcc?.dollarRate ?? data?.dollarRate ?? 132;
    const eSpendVal = editSelectedAcc?.monthlySpending ?? data?.monthlySpending ?? 0;

    return (
      <form
        onSubmit={isEdit ? handleEditSubmit : handleSubmit}
        className="space-y-4"
        id={isEdit ? 'form-edit-setup' : 'form-add-setup'}
      >
        {/* Row 1: Group ID (searchable) + Customer (auto) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group ID Code</label>
            {isEdit ? (
              <input
                type="text"
                value={eGroupId}
                readOnly
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 font-mono cursor-not-allowed"
              />
            ) : (
              <>
                <SearchableSelect
                  options={groupIdOptions}
                  value={formGroupId}
                  onChange={handleGroupIdChange}
                  placeholder={customersLoading ? 'Loading group IDs...' : 'Select Group ID...'}
                  emptyText={customersLoading ? 'Loading...' : 'No active clients with Group ID found'}
                  disabled={customersLoading}
                />
                {formErrors.groupId && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{formErrors.groupId}</p>
                )}
              </>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer</label>
            <div className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-semibold">
              {(() => {
                const c = customers.find(x => x.groupId === eGroupId);
                if (customersLoading) return <span className="text-slate-400 font-normal">Loading customers...</span>;
                return c ? `${c.name} (${c.companyName})` : <span className="text-slate-400 font-normal">Select a Group ID first</span>;
              })()}
            </div>
          </div>
        </div>

        {/* Service Type */}
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Type</label>
          {isEdit ? (
            <select
              value={data?.serviceType || 'Ad Account Topup'}
              onChange={(e) => setData({ ...data, serviceType: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Ad Account Topup">Ad Account Top-up</option>
              <option value="Others">Others</option>
            </select>
          ) : (
            <select
              value={formServiceType}
              onChange={(e) => setFormServiceType(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Ad Account Topup">Ad Account Top-up</option>
              <option value="Others">Others</option>
            </select>
          )}
        </div>

        {/* If Ad Account Topup */}
        {!isOthers && (
          <>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Select Ad Account</label>
              {isEdit ? (
                <SearchableSelect
                  options={eAdAccountOptions}
                  value={eAdAccountId}
                  onChange={(v) => {
                    const a = adAccounts.find(x => x.adAccountId === v);
                    setData({
                      ...data,
                      adAccountId: v,
                      adName: a?.adAccountName || data.adName,
                      platform: a?.platform || data.platform,
                      dollarRate: a?.dollarRate || data.dollarRate,
                      monthlySpending: a?.monthlySpending || data.monthlySpending
                    });
                  }}
                  placeholder={eCustomerId ? 'Select ad account...' : 'Select a customer first'}
                  disabled={!eCustomerId}
                  emptyText="No ad accounts found for this customer"
                />
              ) : (
                <div>
                  <SearchableSelect
                    options={adAccountOptions}
                    value={formAdAccountId}
                    onChange={handleAdAccountChange}
                    placeholder={formCustomerId ? (adAccountsLoading ? 'Loading ad accounts...' : 'Select ad account...') : 'Select a customer first'}
                    disabled={!formCustomerId || adAccountsLoading}
                    emptyText="No ad accounts found for this customer"
                  />
                  {formErrors.adAccountId && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{formErrors.adAccountId}</p>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
                <input
                  type="text"
                  value={isEdit ? (data?.platform || '') : (selectedAdAccount?.platform || '')}
                  readOnly
                  className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Dollar Rate (৳)</label>
                <input
                  type="number"
                  value={isEdit ? eRateVal : derivedRate}
                  readOnly
                  className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Monthly Spending ($)</label>
                <input
                  type="number"
                  value={isEdit ? eSpendVal : (selectedAdAccount ? derivedSpend : '')}
                  readOnly
                  className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold cursor-not-allowed"
                />
              </div>
            </div>
          </>
        )}

        {/* If Others */}
        {isOthers && (
          <>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Details</label>
              {isEdit ? (
                <input
                  type="text"
                  value={eServiceDetails}
                  onChange={(e) => setData({ ...data, serviceDetails: e.target.value, adName: e.target.value })}
                  required
                  placeholder="e.g. Creative Design, Landing Page..."
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
                />
              ) : (
                <div>
                  <input
                    type="text"
                    value={formServiceDetails}
                    onChange={(e) => { setFormServiceDetails(e.target.value); clearError('serviceDetails'); }}
                    required
                    placeholder="e.g. Creative Design, Landing Page..."
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
                  />
                  {formErrors.serviceDetails && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{formErrors.serviceDetails}</p>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Service Fee (BDT ৳)</label>
              {isEdit ? (
                <input
                  type="number"
                  value={eServiceFee}
                  onChange={(e) => setData({ ...data, serviceFee: Number(e.target.value) })}
                  required
                  placeholder="e.g. 5000"
                  className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
                />
              ) : (
                <div>
                  <input
                    type="number"
                    value={formServiceFee}
                    onChange={(e) => { setFormServiceFee(Number(e.target.value)); clearError('serviceFee'); }}
                    required
                    placeholder="e.g. 5000"
                    className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
                  />
                  {formErrors.serviceFee && (
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{formErrors.serviceFee}</p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* User ID (kept editable) + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">User ID</label>
            {isEdit ? (
              <input
                type="text"
                value={data?.userId || ''}
                onChange={(e) => setData({ ...data, userId: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            ) : (
              <input
                type="text"
                value={formUserId}
                onChange={(e) => setFormUserId(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            {isEdit ? (
              <select
                value={data?.status || 'Active'}
                onChange={(e) => setData({ ...data, status: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Active">Active</option>
                <option value="Sold">Sold</option>
                <option value="Disable">Disable</option>
                <option value="Need Support">Need Support</option>
                <option value="Available">Available</option>
              </select>
            ) : (
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Active">Active</option>
                <option value="Sold">Sold</option>
                <option value="Disable">Disable</option>
                <option value="Need Support">Need Support</option>
                <option value="Available">Available</option>
              </select>
            )}
          </div>
        </div>

        <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="ghost"
            onClick={() => isEdit ? setShowEditModal(false) : setShowModal(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!isEdit && submitting}>
            {isEdit ? 'Save Changes' : (submitting ? 'Creating...' : 'Create')}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Active Campaign Setup</h1>
          <p className="text-sm text-slate-500">Assign Group IDs, User IDs, and monitor monthly spending limits.</p>
        </div>
        <Button
          id="btn-add-setup"
          onClick={openAddModal}
          leftIcon={<Plus size={14} />}
        >
          New Campaign Setup
        </Button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <SearchBar
            showIcon={false}
            placeholder="Search by Ad Name or Group Code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
              {filtered.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="py-3 pl-4 font-bold text-slate-800 dark:text-slate-200 font-mono">{s.groupId}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                      s.serviceType === 'Others'
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60'
                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60'
                    }`}>
                      {s.serviceType || 'Ad Account Topup'}
                    </span>
                  </td>
                  <td className="py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {s.serviceType === 'Others' ? (s.serviceDetails || s.adName) : s.adName}
                  </td>
                  <td className="py-3">{s.serviceType === 'Others' ? <span className="text-slate-400">—</span> : <PlatformText platform={s.platform} />}</td>
                  <td className="py-3 text-center font-bold">
                    {s.serviceType === 'Others' ? <span className="text-slate-400">—</span> : `৳${s.dollarRate}`}
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {s.serviceType === 'Others'
                      ? <span className="text-amber-700 dark:text-amber-300">৳{(s.serviceFee || 0).toLocaleString()}</span>
                      : `$${s.monthlySpending}`}
                  </td>
                  <td className="py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block ${
                      s.status === 'Active' || s.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                      s.status === 'Need Support' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Campaign Ad Assignment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add Campaign Ad Assignment"
        size="md"
        showCloseButton={false}
      >
        {renderForm(null, null, false)}
      </Modal>

      {/* Edit Campaign Ad Assignment Modal */}
      <Modal
        isOpen={showEditModal && !!editSetupData}
        onClose={() => setShowEditModal(false)}
        title="Edit Campaign Ad Assignment"
        size="md"
        showCloseButton={false}
      >
        {renderForm(editSetupData, setEditSetupData, true)}
      </Modal>
    </div>
  );
}

export default memo(SaleSetupView);

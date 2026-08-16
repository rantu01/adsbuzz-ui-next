 'use client';
import { memo, useEffect, useState } from 'react';
import { Plus, FileEdit, DollarSign, User, Check, Trash2, History, Edit3, CalendarDays } from 'lucide-react';
import { VENDOR_TYPES } from '@/constants/vendorTypes';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchBar from '@/components/ui/SearchBar';
import StatCard from '@/components/common/StatCard';
import Pagination from '@/components/common/Pagination';

function bdtToUsd(bdt, rate) {
  const bdtVal = Number(bdt) || 0;
  const rateVal = Number(rate) || 0;
  return rateVal > 0 ? bdtVal / rateVal : 0;
}

// Display value (BDT) for a payment entry. Prefers the exact BDT amount
// recorded at entry time so the entered and displayed amounts always match;
// falls back to converting the stored USD amount for legacy records that
// predate BDT persistence.
function paymentBdt(ph, rate) {
  if (ph && ph.amountBDT != null) return Number(ph.amountBDT) || 0;
  return Math.round((Number(ph?.amountUSD) || 0) * (Number(rate) || 0));
}

function formatBdtValue(value) {
  return Math.round(Number(value) || 0).toLocaleString();
}

function sumPaymentBdt(payments, rate) {
  return (payments || []).reduce((sum, ph) => sum + paymentBdt(ph, rate), 0);
}

function VendorsView({ vendors, onAddVendor, onUpdateVendor, onPayVendor, onDeleteVendor, paymentMethods, error, onRetry, dollarRate = 0 }) {
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAllPaymentsModal, setShowAllPaymentsModal] = useState(false);
  const [payVendorData, setPayVendorData] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payChannel, setPayChannel] = useState(paymentMethods[0] ?? '');
  const [deleteVendorData, setDeleteVendorData] = useState(null);

  const [vendorType, setVendorType] = useState(VENDOR_TYPES[5]);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('Active');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [editVendorData, setEditVendorData] = useState(null);
  const [editPaymentData, setEditPaymentData] = useState(null);
  const [deletePaymentData, setDeletePaymentData] = useState(null);

  const [overviewMonth, setOverviewMonth] = useState('');
  const [overviewVendor, setOverviewVendor] = useState('');

  const [vendorPage, setVendorPage] = useState(1);
  const VENDOR_PAGE_SIZE = 10;

  const query = search.trim().toLowerCase();
  const filtered = vendors.filter(v => {
    if (!query) return true;
    return [v.name, v.id, v.vendorType, v.email, v.phone, v.status]
      .filter(Boolean)
      .some(field => String(field).toLowerCase().includes(query));
  });

  useEffect(() => {
    setVendorPage(1);
  }, [search]);

  const vendorTotalPages = Math.max(1, Math.ceil(filtered.length / VENDOR_PAGE_SIZE));
  const safeVendorPage = Math.min(vendorPage, vendorTotalPages);
  const pagedVendors = filtered.slice(
    (safeVendorPage - 1) * VENDOR_PAGE_SIZE,
    safeVendorPage * VENDOR_PAGE_SIZE,
  );

  const activeVendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];

  const currentMonth = new Date().toISOString().substring(0, 7);
  const vendorPaidThisMonth = activeVendor
    ? sumPaymentBdt(
        activeVendor.paymentHistory.filter(ph => ph.date && ph.date.startsWith(currentMonth)),
        dollarRate
      )
    : 0;
  const vendorTotalPaid = activeVendor
    ? sumPaymentBdt(activeVendor.paymentHistory, dollarRate)
    : 0;

  const getAllPayments = () =>
    vendors.flatMap(v =>
      (v.paymentHistory || []).map(ph => ({
        ...ph,
        vendorId: v.id,
        vendorName: v.name,
        vendorStatus: v.status,
      }))
    );

  const allVendorPayments = getAllPayments();
  const totalVendorPaymentUSD = sumPaymentBdt(allVendorPayments, dollarRate);
  const totalVendorPaymentMonthUSD = sumPaymentBdt(
    allVendorPayments.filter(ph => ph.date && ph.date.startsWith(currentMonth)),
    dollarRate
  );
  const totalActiveVendors = vendors.filter(v => v.status === 'Active' || v.status === 'Available').length;

  const vendorMonthTotals = {};
  vendors.forEach(v => {
    const monthPaid = sumPaymentBdt(
      (v.paymentHistory || []).filter(ph => ph.date && ph.date.startsWith(currentMonth)),
      dollarRate
    );
    if (monthPaid > 0) vendorMonthTotals[v.id] = { name: v.name, total: monthPaid };
  });
  const topVendor = Object.values(vendorMonthTotals).sort((a, b) => b.total - a.total)[0] || null;

  const overviewPayments = allVendorPayments.filter(ph => {
    const matchesMonth = overviewMonth === '' || (ph.date && ph.date.startsWith(overviewMonth));
    const matchesVendor = overviewVendor === '' || ph.vendorId === overviewVendor;
    return matchesMonth && matchesVendor;
  });
  const overviewTotalUSD = sumPaymentBdt(overviewPayments, dollarRate);

  const availableMonths = Array.from(
    new Set(allVendorPayments.filter(ph => ph.date).map(ph => ph.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const handleSubmit = (e) => {
    e.preventDefault();
    onAddVendor({
      id: `VEND-${Date.now().toString().slice(-4)}`,
      name,
      vendorType,
      outstandingBalanceUSD: 0,
      paymentHistory: [],
      status,
      email,
      phone
    });
    setName('');
    setEmail('');
    setPhone('');
    setVendorType(VENDOR_TYPES[5]);
    setStatus('Active');
    setShowModal(false);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editVendorData) return;
    if (onUpdateVendor) {
      onUpdateVendor(editVendorData);
    }
    setShowEditModal(false);
    setEditVendorData(null);
  };

  const handlePaySubmit = (e) => {
    e.preventDefault();
    if (!payVendorData) return;
    if (!payAmount) return;

    const parsedBdt = Number(payAmount);
    const selectedChannel = payChannel?.trim();

    if (!Number.isFinite(parsedBdt) || parsedBdt <= 0) return;
    if (!selectedChannel) return;

    const parsedAmountUSD = bdtToUsd(parsedBdt, dollarRate);

    if (onPayVendor) {
      onPayVendor(payVendorData.id, {
        amountUSD: parsedAmountUSD,
        amountBDT: parsedBdt,
        paymentMethod: selectedChannel,
      });
    } else {
      const newPaymentEntry = {
        date: new Date().toISOString().slice(0, 10),
        amountUSD: parsedAmountUSD,
        amountBDT: parsedBdt,
        paymentMethod: selectedChannel,
        transactionId: `PAY-${Date.now().toString().slice(-6)}`,
      };

      const updatedVendor = {
        ...payVendorData,
        paymentHistory: [...payVendorData.paymentHistory, newPaymentEntry],
        outstandingBalanceUSD: Math.max(0, payVendorData.outstandingBalanceUSD - parsedAmountUSD),
      };

      if (onUpdateVendor) {
        onUpdateVendor(updatedVendor);
      }
    }

    setShowPayModal(false);
    setPayVendorData(null);
    setPayAmount('');
    setPayChannel(paymentMethods[0] ?? '');
  };

  const openEditModal = (v) => {
    setEditVendorData({ ...v });
    setShowEditModal(true);
  };

  const openPayModal = (v) => {
    setPayVendorData(v);
    setPayAmount('');
    setPayChannel(paymentMethods[0] ?? '');
    setShowPayModal(true);
  };

  const openDeleteModal = (v) => {
    setDeleteVendorData(v);
    setShowDeleteModal(true);
  };

  const openEditPaymentModal = (vendor, payment, index) => {
    setEditPaymentData({
      ...payment,
      editAmountBDT: paymentBdt(payment, dollarRate),
      editMethod: payment.paymentMethod || '',
      editDate: payment.date || '',
      editTxnId: payment.transactionId || '',
      vendorId: vendor.id,
      vendorName: vendor.name,
      index,
    });
  };

  const handleEditPaymentSubmit = (e) => {
    e.preventDefault();
    if (!editPaymentData || !activeVendor || !onUpdateVendor) return;

    const { index, editAmountBDT, editMethod, editDate, editTxnId } = editPaymentData;
    const original = activeVendor.paymentHistory[index];
    if (!original) return;

    const newAmountUSD = bdtToUsd(editAmountBDT, dollarRate);

    const updatedHistory = [...activeVendor.paymentHistory];
    updatedHistory[index] = {
      date: editDate || original.date,
      amountUSD: newAmountUSD,
      amountBDT: Number(editAmountBDT) || 0,
      paymentMethod: editMethod || original.paymentMethod,
      transactionId: editTxnId || original.transactionId,
    };

    onUpdateVendor({ ...activeVendor, paymentHistory: updatedHistory });
    setEditPaymentData(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteVendorData || !onDeleteVendor) return;
    const deletedId = deleteVendorData.id;
    try {
      await onDeleteVendor(deletedId);
    } catch {
      // Error toast raised by the hook/context.
    } finally {
      setShowDeleteModal(false);
      setDeleteVendorData(null);
      const remaining = vendors.filter(v => v.id !== deletedId);
      if (remaining.length > 0) {
        setSelectedVendorId(remaining[0].id);
      } else {
        setSelectedVendorId('');
      }
    }
  };

   const selectedVendorPayments = (activeVendor?.paymentHistory ?? [])
    .map((ph) => ({
      vendorId: activeVendor.id,
      vendorName: activeVendor.name,
      vendorType: activeVendor.vendorType,
      ...ph,
    }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <div className="space-y-6 animate-fade-in">
      <ErrorBanner error={error} onRetry={onRetry} />
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Vendor &amp; Publisher Partners</h1>
          <p className="text-sm text-slate-500">Monitor outstanding balances with primary ad account source wholesalers.</p>
        </div>
        <Button
          id="btn-add-vendor"
          onClick={() => setShowModal(true)}
          leftIcon={<Plus size={14} />}
        >
          Onboard Vendor
        </Button>
      </div>

      {/* Vendor Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard
           title="TOTAL VENDOR PAYMENT"
           value={`৳${formatBdtValue(totalVendorPaymentUSD)}`}
           variant="blue"
           subtext="All-time vendor settlements"
           icon={<DollarSign size={20} />}
         />
         <StatCard
           title="VENDOR PAYMENT (CURRENT MONTH)"
           value={`৳${formatBdtValue(totalVendorPaymentMonthUSD)}`}
           variant="emerald"
           subtext={`Month: ${currentMonth}`}
           icon={<DollarSign size={20} />}
         />
         <StatCard
           title="TOTAL ACTIVE VENDOR"
           value={totalActiveVendors}
           variant="amber"
           subtext="Active & available partners"
           icon={<User size={20} />}
         />
         <StatCard
           title="TOP VENDOR"
           value={topVendor ? topVendor.name : '—'}
           variant="indigo"
           subtext={topVendor ? `৳${formatBdtValue(topVendor.total)} paid this month` : 'No payments this month'}
           icon={<DollarSign size={20} />}
         />
       </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div id="vendor-list-card" className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <SearchBar
              showIcon={false}
              maxWidthClass="w-full"
              placeholder="Search vendor..."
              value={search}
              onChange={(value) => setSearch(value)}
            />
          </div>
          <div id="vendors-list-box" className="space-y-1">
            {pagedVendors.map(v => (
              <div
                key={v.id}
                id={`vendor-item-${v.id}`}
                onClick={() => setSelectedVendorId(v.id)}
                style={{ borderLeft: activeVendor?.id === v.id ? '5px solid #154A7D' : '5px solid transparent' }}
                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                  activeVendor?.id === v.id
                    ? 'font-bold'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                }`}
              >
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">{v.name}</h4>
                  <div className="text-[10px] text-slate-400 mt-0.5">Vendor Type: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.vendorType}</span></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm inline-block ${
                    v.status === 'Active' || v.status === 'Available' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                    v.status === 'Need Support' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                    'bg-red-500/10 text-red-600 dark:text-red-400'
                  }`}>
                    {v.status}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(v);
                    }}
                    leftIcon={<FileEdit size={11} />}
                  >
                    Edit
                  </Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-center">
                <User size={20} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No vendors match your search</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Try a different name, ID, type, or email.</p>
              </div>
            )}
          </div>
          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Showing {(safeVendorPage - 1) * VENDOR_PAGE_SIZE + 1}–{Math.min(safeVendorPage * VENDOR_PAGE_SIZE, filtered.length)} of {filtered.length} vendors
              </span>
            </div>
          )}
          <Pagination page={safeVendorPage} totalPages={vendorTotalPages} onPageChange={setVendorPage} />
        </div>

          {activeVendor && (
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6" id="vendor-details-pane">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeVendor.name}</h2>
                  <p className="text-xs text-slate-400 mt-1">Vendor Type: <span className="font-semibold text-slate-700 dark:text-slate-300">{activeVendor.vendorType}</span> | Status: <span className="font-bold text-slate-700 dark:text-slate-300">{activeVendor.status}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAllPaymentsModal(true)}
                    leftIcon={<History size={11} />}
                  >
                     View Payments
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPayModal(activeVendor)}
                    leftIcon={<DollarSign size={11} />}
                  >
                    Pay Vendor
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(activeVendor)}
                    leftIcon={<FileEdit size={11} />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDeleteModal(activeVendor)}
                    leftIcon={<Trash2 size={11} />}
                    className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                  >
                    Delete Vendor
                  </Button>
                </div>
              </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-green dark:bg-surface-green border border-border-green dark:border-border-green">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <DollarSign size={12} className="text-brand-blue-dark dark:text-brand-blue-dark" />
                  <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75">Paid In (Current Month)</p>
                </div>
                 <p className="text-sm font-extrabold text-brand-blue-deep dark:text-brand-blue-deep">
                   ৳{formatBdtValue(vendorPaidThisMonth)}
                 </p>
               </div>

               <div className="p-3.5 rounded-xl bg-surface-orange dark:bg-surface-orange border border-border-orange dark:border-border-orange">
                 <div className="flex items-center gap-1.5 mb-1.5">
                   <DollarSign size={12} className="text-brand-blue-dark dark:text-brand-blue-dark" />
                   <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75">Total Paid (All-time)</p>
                 </div>
                 <p className="text-sm font-extrabold text-brand-blue-deep dark:text-brand-blue-deep">
                   ৳{formatBdtValue(vendorTotalPaid)}
                 </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-blue dark:bg-surface-blue border border-border-blue dark:border-border-blue">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <User size={12} className="text-brand-blue-dark dark:text-brand-blue-dark" />
                  <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75">Vendor ID</p>
                </div>
                <p className="text-sm font-extrabold font-mono text-brand-blue-deep dark:text-brand-blue-deep truncate" title={activeVendor.id}>
                  {activeVendor.id}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface dark:bg-surface border border-border-blue-light dark:border-border-blue-light">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Check size={12} className="text-brand-blue-dark dark:text-brand-blue-dark" />
                  <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75">Status</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                    activeVendor.status === 'Active' || activeVendor.status === 'Available'
                      ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : activeVendor.status === 'Need Support'
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                      : activeVendor.status === 'Sold'
                      ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                      : activeVendor.status === 'Disable' || activeVendor.status === 'Inactive'
                      ? 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {activeVendor.status}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlement Payment Ledger</h4>
              {activeVendor.paymentHistory.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No bank wire settlement logs on file for this partner.</p>
              ) : (
                <div className="space-y-2.5">
                   {activeVendor.paymentHistory.map((ph, index) => (
                     <div key={index} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                       <div>
                         <p className="font-semibold text-slate-800 dark:text-slate-200">{ph.paymentMethod}</p>
                         <p className="text-[10px] text-slate-400 mt-0.5">Ref: {ph.transactionId} on {ph.date}</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <span className="font-bold text-emerald-600">৳{formatBdtValue(paymentBdt(ph, dollarRate))}</span>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={(e) => { e.stopPropagation(); openEditPaymentModal(activeVendor, ph, index); }}
                           leftIcon={<Edit3 size={10} />}
                           className="h-5 text-[9px] px-1.5"
                         >
                           Edit
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={(e) => { e.stopPropagation(); setDeletePaymentData({ vendorId: activeVendor.id, index }); }}
                           leftIcon={<Trash2 size={10} />}
                           className="h-5 text-[9px] px-1.5 border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:text-rose-400"
                         >
                           Delete
                         </Button>
                       </div>
                     </div>
                   ))}
                 </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vendor Payment Overview */}
      <div id="vendor-payment-overview" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Vendor Payment Overview</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Filter vendor payments by month and vendor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <CalendarDays size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <select
                id="overview-month-filter"
                value={overviewMonth}
                onChange={(e) => setOverviewMonth(e.target.value)}
                className="text-[11px] pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="">All Months</option>
                {availableMonths.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <User size={14} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
              <select
                id="overview-vendor-filter"
                value={overviewVendor}
                onChange={(e) => setOverviewVendor(e.target.value)}
                className="text-[11px] pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="">All Vendors</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-5">
          {overviewPayments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No payment records match the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-slate-50 dark:bg-slate-800/40">
                  <tr>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-2">Date</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-2">Vendor</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-2">Payment Method</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-2">Reference</th>
                    <th className="text-right font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-2">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {overviewPayments
                    .slice()
                    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
                    .map((ph, idx) => (
                      <tr key={idx} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{ph.date || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200 font-semibold">{ph.vendorName}</td>
                        <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{ph.paymentMethod || '—'}</td>
                        <td className="px-2 py-1.5 text-slate-500 dark:text-slate-500 font-mono truncate max-w-[130px]" title={ph.transactionId}>{ph.transactionId || '—'}</td>
<td className="px-2 py-1.5 text-right font-bold text-emerald-600">৳{formatBdtValue(paymentBdt(ph, dollarRate))}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {overviewPayments.length > 0 && (
            <div className="flex justify-end gap-6 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                Records: <span className="font-bold text-slate-700 dark:text-slate-200">{overviewPayments.length}</span>
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                Total: <span className="font-bold text-emerald-600">৳{formatBdtValue(overviewTotalUSD)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Onboard Wholesaler Vendor"
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handleSubmit} className="space-y-4" id="form-add-vendor">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. APAC Wholesaler A" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Type</label>
            <select value={vendorType} onChange={(e) => setVendorType(e.target.value)} className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium">
              {VENDOR_TYPES.map((vt) => (
                <option key={vt} value={vt}>{vt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium">
              <option value="Active">Active</option>
              <option value="Disable">Disable</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Billing Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01711..." className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Support Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vendor@partner.com" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
            </div>
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit">Save Vendor</Button>
          </div>
        </form>
      </Modal>

      {/* Pay Vendor Modal */}
      <Modal
        isOpen={showPayModal && !!payVendorData}
        onClose={() => setShowPayModal(false)}
        title="Pay Vendor"
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handlePaySubmit} className="space-y-4" id="form-pay-vendor">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Name</label>
            <input
              type="text"
              value={payVendorData?.name ?? ''}
              disabled
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Phone</label>
            <input
              type="text"
              value={payVendorData?.phone ?? ''}
              disabled
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount to Pay (BDT)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="৳0.00"
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Channel</label>
            <select
              required
              value={payChannel}
              onChange={(e) => setPayChannel(e.target.value)}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              {paymentMethods.map(pm => (
                <option key={pm} value={pm}>{pm}</option>
              ))}
            </select>
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowPayModal(false)}>Cancel</Button>
            <Button type="submit">Record Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Vendor Modal */}
      <Modal
        isOpen={showEditModal && !!editVendorData}
        onClose={() => setShowEditModal(false)}
        title="Edit Vendor Record"
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" id="form-edit-vendor">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Name</label>
            <input
              type="text"
              value={editVendorData?.name ?? ''}
              onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, name: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Vendor Type</label>
            <select
              value={editVendorData?.vendorType ?? VENDOR_TYPES[5]}
              onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, vendorType: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              {VENDOR_TYPES.map((vt) => (
                <option key={vt} value={vt}>{vt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
            <select
              value={editVendorData?.status ?? 'Active'}
              onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, status: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Active">Active</option>
              <option value="Sold">Sold</option>
              <option value="Disable">Disable</option>
              <option value="Need Support">Need Support</option>
              <option value="Available">Available</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Billing Phone</label>
              <input
                type="text"
                value={editVendorData?.phone ?? ''}
                onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, phone: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Support Email</label>
              <input
                type="email"
                value={editVendorData?.email ?? ''}
                onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, email: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Vendor Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteVendorData(null); }}
        onConfirm={handleConfirmDelete}
        title="Delete Vendor?"
        message={`This will permanently remove ${deleteVendorData?.name} (${deleteVendorData?.id}) from the vendor roster. This action cannot be undone.`}
        confirmLabel="Delete Vendor"
        variant="danger"
      />

      {/* View Selected Vendor Payments Modal */}
      <Modal
        isOpen={showAllPaymentsModal}
        onClose={() => setShowAllPaymentsModal(false)}
        title="Payment History"
        description={`Settlement payments recorded for ${activeVendor?.name ?? 'this vendor'}.`}
        size="lg"
        scrollable
      >
        <div className="space-y-3">
{selectedVendorPayments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No payment records on file.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Date</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Payment Method</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Reference</th>
                    <th className="text-right font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Amount (BDT)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVendorPayments.map((ph, index) => (
                    <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{ph.date || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{ph.paymentMethod || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-500 dark:text-slate-500 font-mono truncate max-w-[120px]" title={ph.transactionId}>{ph.transactionId || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-emerald-600">৳{formatBdtValue(paymentBdt(ph, dollarRate))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Total: ৳{formatBdtValue(sumPaymentBdt(selectedVendorPayments, dollarRate))}
            </span>
          </div>
        </div>
      </Modal>

      {/* Edit Payment Modal */}
      <Modal
        isOpen={!!editPaymentData}
        onClose={() => setEditPaymentData(null)}
        title="Edit Payment Record"
        description={editPaymentData ? `Editing payment for ${editPaymentData.vendorName}.` : undefined}
        size="sm"
        showCloseButton={false}
      >
        <form onSubmit={handleEditPaymentSubmit} className="space-y-4" id="form-edit-payment">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount (BDT)</label>
            <input
              type="text"
              inputMode="decimal"
              value={editPaymentData?.editAmountBDT ?? ''}
              onChange={(e) => editPaymentData && setEditPaymentData({ ...editPaymentData, editAmountBDT: e.target.value })}
              placeholder="৳0.00"
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Method</label>
            <input
              type="text"
              value={editPaymentData?.editMethod ?? ''}
              onChange={(e) => editPaymentData && setEditPaymentData({ ...editPaymentData, editMethod: e.target.value })}
              placeholder="e.g. Wire Transfer"
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={editPaymentData?.editDate ?? ''}
              onChange={(e) => editPaymentData && setEditPaymentData({ ...editPaymentData, editDate: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Transaction ID</label>
            <input
              type="text"
              value={editPaymentData?.editTxnId ?? ''}
              onChange={(e) => editPaymentData && setEditPaymentData({ ...editPaymentData, editTxnId: e.target.value })}
              placeholder="e.g. PAY-123456"
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-mono"
            />
          </div>
          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setEditPaymentData(null)}>Cancel</Button>
            <Button type="submit">Save Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Delete Payment Confirmation */}
      <ConfirmDialog
        isOpen={!!deletePaymentData}
        onClose={() => setDeletePaymentData(null)}
        onConfirm={() => {
          const d = deletePaymentData;
          setDeletePaymentData(null);
          if (d && activeVendor && activeVendor.id === d.vendorId && onUpdateVendor) {
            const updatedHistory = activeVendor.paymentHistory.filter((_, i) => i !== d.index);
            onUpdateVendor({ ...activeVendor, paymentHistory: updatedHistory });
          }
        }}
        title="Delete Payment?"
        message={`This will permanently remove this payment record from ${activeVendor?.name ?? 'the vendor'}. This action cannot be undone.`}
        confirmLabel="Delete Payment"
        variant="danger"
      />
    </div>
  );
}

export default memo(VendorsView);
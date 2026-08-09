 'use client';
import { memo, useState } from 'react';
import { Plus, FileEdit, DollarSign, User, Check, Trash2, History } from 'lucide-react';
import { VENDOR_TYPES } from '@/constants/vendorTypes';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import ErrorBanner from '@/components/ui/ErrorBanner';
import SearchBar from '@/components/ui/SearchBar';

function VendorsView({ vendors, onAddVendor, onUpdateVendor, onPayVendor, onDeleteVendor, paymentMethods, error, onRetry }) {
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

  const filtered = vendors.filter(v => v.name.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase()));
  const activeVendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];

  const currentMonth = new Date().toISOString().substring(0, 7);
  const vendorPaidThisMonth = activeVendor
    ? activeVendor.paymentHistory
        .filter(ph => ph.date && ph.date.startsWith(currentMonth))
        .reduce((sum, ph) => sum + (ph.amountUSD || 0), 0)
    : 0;
  const vendorTotalPaid = activeVendor
    ? activeVendor.paymentHistory.reduce((sum, ph) => sum + (ph.amountUSD || 0), 0)
    : 0;

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

    const parsedAmount = Number(payAmount);
    const selectedChannel = payChannel?.trim();

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    if (!selectedChannel) return;

    if (onPayVendor) {
      onPayVendor(payVendorData.id, {
        amountUSD: parsedAmount,
        paymentMethod: selectedChannel,
      });
    } else {
      const newPaymentEntry = {
        date: new Date().toISOString().slice(0, 10),
        amountUSD: parsedAmount,
        paymentMethod: selectedChannel,
        transactionId: `PAY-${Date.now().toString().slice(-6)}`,
      };

      const updatedVendor = {
        ...payVendorData,
        paymentHistory: [...payVendorData.paymentHistory, newPaymentEntry],
        outstandingBalanceUSD: Math.max(0, payVendorData.outstandingBalanceUSD - parsedAmount),
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

  const allVendorPayments = vendors
    .filter(v => Array.isArray(v.paymentHistory) && v.paymentHistory.length > 0)
    .flatMap(v =>
      v.paymentHistory.map((ph) => ({
        vendorId: v.id,
        vendorName: v.name,
        vendorType: v.vendorType,
        ...ph,
      })),
    )
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div id="vendor-list-card" className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <SearchBar
              showIcon={false}
              maxWidthClass="w-full"
              placeholder="Search vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div id="vendors-list-box" className="space-y-1">
            {filtered.map(v => (
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
          </div>
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
                    View All Payments
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
                  ${vendorPaidThisMonth.toLocaleString()}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-orange dark:bg-surface-orange border border-border-orange dark:border-border-orange">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <DollarSign size={12} className="text-brand-blue-dark dark:text-brand-blue-dark" />
                  <p className="text-[10px] uppercase font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75">Total Paid (All-time)</p>
                </div>
                <p className="text-sm font-extrabold text-brand-blue-deep dark:text-brand-blue-deep">
                  ${vendorTotalPaid.toLocaleString()}
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
                    <div key={index} className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 flex justify-between text-xs">
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{ph.paymentMethod}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Ref: {ph.transactionId} on {ph.date}</p>
                      </div>
                      <span className="font-bold text-emerald-600">${ph.amountUSD}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
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
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount to Pay (USD)</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
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

      {/* View All Vendor Payments Modal */}
      <Modal
        isOpen={showAllPaymentsModal}
        onClose={() => setShowAllPaymentsModal(false)}
        title="All Vendor Payment History"
        description="Complete ledger of settlement payments recorded across all vendors."
        size="lg"
        scrollable
      >
        <div className="space-y-3">
          {allVendorPayments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No payment records on file.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full text-[10px]">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Date</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Vendor</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Vendor Type</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Payment Method</th>
                    <th className="text-left font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Reference</th>
                    <th className="text-right font-bold text-slate-500 dark:text-slate-400 uppercase px-2 py-1.5">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {allVendorPayments.map((ph, index) => (
                    <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{ph.date || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200 font-medium truncate max-w-[140px]" title={ph.vendorName}>{ph.vendorName}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{ph.vendorType || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-600 dark:text-slate-400">{ph.paymentMethod || '—'}</td>
                      <td className="px-2 py-1.5 text-slate-500 dark:text-slate-500 font-mono truncate max-w-[120px]" title={ph.transactionId}>{ph.transactionId || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-emerald-600">${ph.amountUSD || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Total: ${allVendorPayments.reduce((sum, ph) => sum + (ph.amountUSD || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default memo(VendorsView);
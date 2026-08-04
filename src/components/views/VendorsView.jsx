'use client';
import { memo, useState } from 'react';
import { Plus, FileEdit, DollarSign, User, Check } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';

function VendorsView({ vendors, onAddVendor, onUpdateVendor, onPayVendor, paymentMethods, error, onRetry }) {
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState(vendors[0]?.id || '');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payVendorData, setPayVendorData] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payChannel, setPayChannel] = useState(paymentMethods[0] ?? '');

  const [name, setName] = useState('');
  const [plat, setPlat] = useState('Facebook');
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
    if (!name) return;
    onAddVendor({
      id: `VEND-${Date.now().toString().slice(-4)}`,
      name,
      platform: plat,
      outstandingBalanceUSD: 0,
      paymentHistory: [],
      status,
      email,
      phone
    });
    setName('');
    setEmail('');
    setPhone('');
    setPlat('Facebook');
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
                  <div className="text-[10px] text-slate-400 mt-0.5"><PlatformText platform={v.platform} className="text-[10px]" /></div>
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
                <p className="text-xs text-slate-400 mt-1">Platform: <PlatformText platform={activeVendor.platform} className="text-xs font-semibold" /> | Status: <span className="font-bold text-slate-700 dark:text-slate-300">{activeVendor.status}</span></p>
              </div>
              <div className="flex items-center gap-2">
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
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. APAC Wholesaler A" className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
            <select value={plat} onChange={(e) => setPlat(e.target.value)} className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium">
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Google">Google</option>
              <option value="Snapchat">Snapchat</option>
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
              required
              value={editVendorData?.name ?? ''}
              onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, name: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Platform</label>
            <select
              value={editVendorData?.platform ?? 'Facebook'}
              onChange={(e) => editVendorData && setEditVendorData({ ...editVendorData, platform: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
            >
              <option value="Facebook">Facebook</option>
              <option value="TikTok">TikTok</option>
              <option value="Google">Google</option>
              <option value="Snapchat">Snapchat</option>
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
    </div>
  );
}

export default memo(VendorsView);
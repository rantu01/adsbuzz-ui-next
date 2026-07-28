'use client';
import { memo, useState } from 'react';
import { Calendar, Clock, FileEdit } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchBar from '@/components/ui/SearchBar';

function InvoicesView({ invoices, customers, onUpdateInvoice }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const getCustName = (id) => {
    return customers.find(c => c.id === id)?.name || "Cash Client";
  };

  const filtered = invoices.filter(inv => {
    const custName = getCustName(inv.customerId).toLowerCase();
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
                          (inv.groupId && inv.groupId.toLowerCase().includes(search.toLowerCase())) ||
                          inv.adAccountName.toLowerCase().includes(search.toLowerCase()) ||
                          custName.includes(search.toLowerCase()) ||
                          (inv.serviceDetails && inv.serviceDetails.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'All' ? true : inv.paymentStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Date metrics calculations for Overview Cards
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.substring(0, 7);

  const hasCurrentMonthInvoices = invoices.some(i => i.date && i.date.startsWith(currentMonthStr));
  const activeMonthStr = hasCurrentMonthInvoices
    ? currentMonthStr
    : (invoices.length > 0 && invoices[0].date ? invoices[0].date.substring(0, 7) : currentMonthStr);

  const currentMonthInvoices = invoices.filter(inv => inv.date && inv.date.startsWith(activeMonthStr));
  const currentMonthInvoicesCount = currentMonthInvoices.length;
  const currentMonthUSD = currentMonthInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentMonthBDT = currentMonthInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  const currentMonthOthers = currentMonthInvoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const currentMonthOthersUSD = currentMonthOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const currentMonthOthersBDT = currentMonthOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // Daily (Today)
  const hasTodayInvoices = invoices.some(i => i.date === todayStr);
  const activeTodayStr = hasTodayInvoices
    ? todayStr
    : (invoices.length > 0 && invoices[0].date ? invoices[0].date : todayStr);

  const dailyInvoices = invoices.filter(inv => inv.date === activeTodayStr);
  const dailyInvoicesCount = dailyInvoices.length;
  const dailyUSD = dailyInvoices.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const dailyBDT = dailyInvoices.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  const dailyOthers = dailyInvoices.filter(inv => inv.serviceType === 'Others' || inv.adAccountName?.toLowerCase().includes('other') || inv.serviceDetails);
  const dailyOthersUSD = dailyOthers.reduce((sum, inv) => sum + (inv.topupAmountUSD || 0), 0);
  const dailyOthersBDT = dailyOthers.reduce((sum, inv) => sum + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editingInvoice && onUpdateInvoice) {
      onUpdateInvoice(editingInvoice);
    }
    setShowEditModal(false);
    setEditingInvoice(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transaction Ledger</h1>
        <p className="text-sm text-slate-500">Historical database of all top-up invoice settlements.</p>
      </div>

      {/* Top Short Overview Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current Month Overview Card */}
        <div className="bg-surface-blue dark:bg-surface-blue p-5 rounded-2xl border border-border-blue dark:border-border-blue space-y-3">
          <div className="flex justify-between items-center border-b border-border-blue dark:border-border-blue pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-blue-deep dark:text-brand-blue-deep flex items-center gap-1.5">
              <Calendar size={14} className="text-brand-blue-dark dark:text-brand-blue-dark" />
              Current Month ({activeMonthStr})
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-brand-blue-deep dark:text-brand-blue-deep border border-border-blue dark:border-border-blue">
              Monthly Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue-light dark:border-border-blue-light shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">{currentMonthInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-brand-blue-deep/65 dark:text-brand-blue-deep/65">Month records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue-light dark:border-border-blue-light shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Sales (USD &amp; BDT)</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentMonthUSD.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-brand-blue-deep dark:text-brand-blue-deep">৳{currentMonthBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-blue-light dark:border-border-blue-light shadow-xs">
              <p className="text-[10px] font-bold text-brand-blue-deep/75 dark:text-brand-blue-deep/75 uppercase tracking-wide">Total Other Service Sales</p>
              <p className="text-sm font-black text-brand-blue-deep dark:text-brand-blue-deep mt-1">${currentMonthOthersUSD.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-brand-blue-deep dark:text-brand-blue-deep">৳{currentMonthOthersBDT.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Daily Overview Card */}
        <div className="bg-surface-green dark:bg-surface-green p-5 rounded-2xl border border-border-green dark:border-border-green space-y-3">
          <div className="flex justify-between items-center border-b border-border-green dark:border-border-green pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-status-green-deep dark:text-status-green-deep flex items-center gap-1.5">
              <Clock size={14} className="text-status-green-deep dark:text-status-green-deep" />
              Daily ({activeTodayStr})
            </h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface dark:bg-surface text-status-green-deep dark:text-status-green-deep border border-border-green dark:border-border-green">
              Today Summary
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Invoices</p>
              <p className="text-xl font-black text-status-green-deep dark:text-status-green-deep mt-1">{dailyInvoicesCount}</p>
              <p className="text-[9px] font-semibold text-status-green-deep/65 dark:text-status-green-deep/65">Today records</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Sell (USD &amp; BDT)</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep mt-1">${dailyUSD.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-status-green-deep dark:text-status-green-deep">৳{dailyBDT.toLocaleString()}</p>
            </div>
            <div className="bg-surface dark:bg-surface p-3.5 rounded-xl border border-border-green dark:border-border-green shadow-xs">
              <p className="text-[10px] font-bold text-status-green-deep/75 dark:text-status-green-deep/75 uppercase tracking-wide">Total Others Service Sell</p>
              <p className="text-sm font-black text-status-green-deep dark:text-status-green-deep mt-1">${dailyOthersUSD.toLocaleString()}</p>
              <p className="text-[10px] font-bold text-status-green-deep dark:text-status-green-deep">৳{dailyOthersBDT.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <SearchBar
          maxWidthClass="w-full sm:max-w-xs"
          placeholder="Search invoice or group code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 w-full sm:w-auto">
          {(['All', 'Paid', 'Due', 'Partially Paid']).map(st => {
            const isSelected = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  backgroundColor: isSelected ? '#1F5E98' : '#F68B2D',
                  color: '#ffffff',
                  borderColor: isSelected ? '#1F5E98' : '#F68B2D',
                }}
                className={`text-xs font-black px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer shadow-xs ${
                  isSelected
                    ? 'ring-2 ring-blue-500/40 scale-105 opacity-100'
                    : 'opacity-85 hover:opacity-100 hover:scale-102'
                }`}
              >
                {st}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-center text-xs border-collapse min-w-[780px]">
            <thead className="bg-brand-blue text-white font-bold tracking-tight">
              <tr>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[11%]">Invoice No</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[12%]">Customer Name</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[9%]">Date</th>
                <th scope="col" className="py-2.5 px-1 uppercase text-[10px] sm:text-[11px] tracking-tight w-[6%]">Group ID</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[18%]">Ad Account Name</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[9%]">Amount USD</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[9%]">BDT</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[9%]">Payment Status</th>
                <th scope="col" className="py-2.5 px-1.5 uppercase text-[10px] sm:text-[11px] tracking-tight w-[9%]">Approval Status</th>
                <th scope="col" className="py-2.5 px-2 uppercase text-[10px] sm:text-[11px] tracking-tight w-[8%]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {filtered.map(inv => {
                const displayGroupId = inv.groupId || 'N/A';
                const adAccountOrService = inv.serviceType === 'Others'
                  ? (inv.serviceDetails || inv.adAccountName || 'Other Service')
                  : inv.adAccountName;
                const approvalStatus = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved';

                return (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-slate-900 dark:text-white font-mono text-[10px] sm:text-[11px] truncate" title={inv.invoiceNo}>{inv.invoiceNo}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-semibold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px] truncate" title={getCustName(inv.customerId)}>{getCustName(inv.customerId)}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-medium text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] truncate">{inv.date}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-mono font-medium text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] truncate">{displayGroupId}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-semibold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px] truncate" title={adAccountOrService}>
                      {adAccountOrService}
                    </td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-black text-slate-900 dark:text-white text-[10px] sm:text-[11px]">${(inv.topupAmountUSD || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-1 sm:px-1.5 text-center font-bold text-slate-800 dark:text-slate-200 text-[10px] sm:text-[11px]">৳{(inv.totalAmountBDT || inv.paidAmountBDT || 0).toLocaleString()}</td>
                    <td className="py-2.5 px-0.5 sm:px-1 text-center">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold truncate max-w-full ${
                        inv.paymentStatus === 'Paid' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                        inv.paymentStatus === 'Partially Paid' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                        'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-0.5 sm:px-1 text-center">
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold truncate max-w-full ${
                        approvalStatus === 'Approved' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                        approvalStatus === 'Pending' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                        'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        {approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <Button
                        variant="outline"
                        size="compact"
                        onClick={() => {
                          setEditingInvoice({ ...inv });
                          setShowEditModal(true);
                        }}
                        leftIcon={<FileEdit size={10} />}
                        className="mx-auto"
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-8 text-slate-400 italic">
                    No invoices match search or selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Invoice Modal */}
      <Modal
        isOpen={showEditModal && !!editingInvoice}
        onClose={() => setShowEditModal(false)}
        title={`Edit Invoice Record #${editingInvoice?.invoiceNo ?? ''}`}
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4" id="form-edit-invoice-modal">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Invoice No</label>
              <input
                type="text"
                value={editingInvoice?.invoiceNo ?? ''}
                readOnly
                className="w-full text-xs p-2 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 font-mono cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Group ID</label>
              <input
                type="text"
                value={editingInvoice?.groupId || ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, groupId: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Customer</label>
              <select
                value={editingInvoice?.customerId || ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, customerId: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="">Select Customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={editingInvoice?.date ?? ''}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, date: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Ad Account Name / Services</label>
            <input
              type="text"
              value={editingInvoice?.adAccountName ?? ''}
              onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, adAccountName: e.target.value })}
              className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Amount in USD ($)</label>
              <input
                type="number"
                value={editingInvoice?.topupAmountUSD ?? 0}
                onChange={(e) => {
                  if (!editingInvoice) return;
                  const usd = Number(e.target.value);
                  const rate = editingInvoice.dollarRate || 130;
                  setEditingInvoice({
                    ...editingInvoice,
                    topupAmountUSD: usd,
                    totalAmountBDT: usd * rate,
                    paidAmountBDT: editingInvoice.paymentStatus === 'Paid' ? usd * rate : editingInvoice.paidAmountBDT
                  });
                }}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">BDT Total (৳)</label>
              <input
                type="number"
                value={editingInvoice?.totalAmountBDT ?? 0}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, totalAmountBDT: Number(e.target.value) })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Status</label>
              <select
                value={editingInvoice?.paymentStatus ?? 'Paid'}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, paymentStatus: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Paid">Paid</option>
                <option value="Due">Due</option>
                <option value="Partially Paid">Partially Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Payment Approval Status</label>
              <select
                value={editingInvoice?.approvalStatus || 'Approved'}
                onChange={(e) => editingInvoice && setEditingInvoice({ ...editingInvoice, approvalStatus: e.target.value })}
                className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 dark:text-white font-medium"
              >
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="custom-modal-footer flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" variant="secondary">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default memo(InvoicesView);

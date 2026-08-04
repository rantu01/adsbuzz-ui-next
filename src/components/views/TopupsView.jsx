'use client';
import { memo, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, ShieldCheck, AlertCircle, CheckCircle, XCircle, Search, DollarSign } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import StatCard from '@/components/common/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

function TopupsView({
  invoices,
  customers,
  onApproveInvoice,
  onRejectInvoice,
  onSyncTopupStatus,
  loading = false,
  error,
  onRetry
}) {

  // Reject confirmation dialog target (invoiceNo)
  const [rejectTarget, setRejectTarget] = useState(null);

  // Get only pending approvals or pending topups
  const pendingInvoices = invoices.filter(inv => 
    inv.approvalStatus === 'Pending' || inv.topupStatus === 'Pending'
  );

  const getCustomerName = (custId) => {
    if (!custId) return 'Cash Client';
    const c = customers.find(cust => cust.id === custId);
    return c ? c.name : 'Unknown';
  };

  return (
    <div className="space-y-8 animate-fade-in" id="topups-view">
      <ErrorBanner error={error} onRetry={onRetry} />
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Financial Audits &amp; Syncs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Audit queue for incoming bKash/EBL payments, top-up API validation, and invoice settlement.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full font-semibold border border-amber-100 dark:border-amber-500/20">
            {pendingInvoices.length} Pending Audits
          </span>
        </div>
      </div>

      {/* Audit Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        <StatCard
          title="QUEUE BACKLOG"
          value={`${pendingInvoices.length} transactions`}
          variant="amber"
          icon={<Clock size={16} />}
          size="compact"
        />
        <StatCard
          title="AUTO-VERIFICATION"
          value="EBL Bank Sync Enabled"
          variant="blue"
          icon={<ShieldCheck size={16} />}
          size="compact"
        />
        <StatCard
          title="AUDIT SLA GOAL"
          value="< 3 mins Average"
          variant="emerald"
          icon={<DollarSign size={16} />}
          size="compact"
        />
      </div>

      {/* Main ledger of pending items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm shadow-slate-100 dark:shadow-none">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Audit Queue</h3>
        </div>
        
        {loading ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Loading audit queue...</h4>
            <p className="text-xs mt-1">Fetching pending approvals and top-up syncs.</p>
          </div>
        ) : pendingInvoices.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500">
            <CheckCircle className="mx-auto mb-3 text-emerald-500" size={40} />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Inbox Completely Settled!</h4>
            <p className="text-xs mt-1">All reseller top-ups have been verified and validated successfully.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400 min-w-[720px]" id="topups-table">
              <thead className="bg-slate-50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/80 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Invoice ID</th>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Customer / Brand</th>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Ad Account / Platform</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Topup USD</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Paid BDT / Channel</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Payment Audit</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Topup API</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30 text-[11px]">
                {pendingInvoices.map((inv) => (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">{inv.invoiceNo}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{getCustomerName(inv.customerId)}</div>
                      <div className="text-[10px] text-slate-400">ID: {inv.customerId}</div>
                    </td>
                    <td className="py-2.5 px-3 min-w-[160px]">
                      <div className="font-normal text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={inv.adAccountName}>{inv.adAccountName}</div>
                      <div className="text-[10px] text-slate-400"><span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-xs"><PlatformText platform={inv.platform} variant="badge" className="text-[10px]" /></span></div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">${inv.topupAmountUSD}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">৳{inv.paidAmountBDT.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">{inv.paymentMethod}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.approvalStatus === 'Approved' 
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60' 
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                      }`}>
                        {inv.approvalStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.topupStatus === 'Successfull' 
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60' 
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60'
                      }`}>
                        {inv.topupStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {inv.approvalStatus === 'Pending' && (
                          <>
                            <button
                              id={`btn-approve-${inv.invoiceNo}`}
                              onClick={() => onApproveInvoice(inv.invoiceNo)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all"
                            >
                              Approve
                            </button>
                            <button
                              id={`btn-reject-${inv.invoiceNo}`}
                              onClick={() => setRejectTarget(inv.invoiceNo)}
                              className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {inv.approvalStatus === 'Approved' && inv.topupStatus === 'Pending' && (
                          <button
                            id={`btn-sync-${inv.invoiceNo}`}
                            onClick={() => onSyncTopupStatus(inv.invoiceNo)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all"
                          >
                            Sync API Done
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject confirmation dialog */}
      <ConfirmDialog
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => {
          if (rejectTarget) onRejectInvoice(rejectTarget);
          setRejectTarget(null);
        }}
        title="Reject this invoice?"
        message={`This will mark invoice #${rejectTarget ?? ''} as Rejected. This action cannot be undone.`}
        confirmLabel="Reject"
        loadingLabel="Rejecting..."
      />
    </div>
  );
}

export default memo(TopupsView);

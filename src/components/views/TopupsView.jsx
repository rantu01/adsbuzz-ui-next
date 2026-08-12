'use client';
import { memo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  DollarSign,
  Eye,
  History,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  CheckCheck,
  XOctagon,
  FileClock,
} from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import StatCard from '@/components/common/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/common/Pagination';

const ACTIVE_AUDIT_STATES = ['Pending', 'Waiting For Feedback', 'Final Approval Review'];
const PAGE_SIZE = 20;

const ACTION_META = {
  created: { label: 'Audit Created', icon: <FileClock size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' },
  approved: { label: 'Approved', icon: <ThumbsUp size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  rejected: { label: 'Rejected — Waiting for Feedback', icon: <ThumbsDown size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
  feedback_submitted: { label: 'Feedback Submitted', icon: <MessageSquare size={13} />, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
  final_approved: { label: 'Final Approval Granted', icon: <CheckCheck size={13} />, tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
  final_rejected: { label: 'Finally Rejected', icon: <XOctagon size={13} />, tone: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 dark:text-rose-400' },
};

function statusTone(status) {
  switch (status) {
    case 'Approved':
      return 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60';
    case 'Waiting For Feedback':
      return 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60';
    case 'Final Approval Review':
      return 'bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200/60 dark:border-violet-800/60';
    case 'Finally Rejected':
    case 'Rejected':
      return 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60';
    default:
      return 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60';
  }
}

function formatActor(actor) {
  if (!actor) return 'System';
  return actor.name || actor.email || actor.uid || 'System';
}

function TopupsView({
  invoices,
  customers,
  onApproveInvoice,
  onRejectInvoice,
  onSubmitFeedback,
  onFinalApproveInvoice,
  onFinalRejectInvoice,
  onSyncTopupStatus,
  loading = false,
  error,
  onRetry
}) {
  const [rejectTarget, setRejectTarget] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);
  const [finalRejectTarget, setFinalRejectTarget] = useState(null);
  const [screenshotTarget, setScreenshotTarget] = useState(null);
  const [logTarget, setLogTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [busyKey, setBusyKey] = useState(null);

  const activeAudits = invoices.filter(inv => ACTIVE_AUDIT_STATES.includes(inv.approvalStatus));

  // Client-side pagination over the already-fetched topup ledger.
  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedInvoices = invoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageStart = (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, invoices.length);

  // Runs a workflow action, keeping a per-row spinner active on the triggering
  // button until the request settles. Errors are surfaced by the hooks' toasts.
  const runAction = async (key, fn) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      await fn();
    } catch {
      // swallowed — the hook already toasted the failure
    } finally {
      setBusyKey(null);
    }
  };

  const getCustomerName = (custId) => {
    if (!custId) return 'Cash Client';
    const c = customers.find(cust => cust.id === custId);
    return c ? c.name : 'Unknown';
  };

  const inputClass =
    'w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue';

  const submitReject = async () => {
    if (!rejectTarget) return;
    const no = rejectTarget.invoiceNo;
    await runAction(`reject-${no}`, async () => {
      await onRejectInvoice(no, rejectTarget.reason);
      setRejectTarget(null);
    });
  };

  const submitFeedback = async () => {
    if (!feedbackTarget) return;
    const no = feedbackTarget.invoiceNo;
    await runAction(`feedback-${no}`, async () => {
      await onSubmitFeedback(no, feedbackTarget.feedback);
      setFeedbackTarget(null);
    });
  };

  const submitFinalReject = async () => {
    if (!finalRejectTarget) return;
    const no = finalRejectTarget.invoiceNo;
    await runAction(`final-reject-${no}`, async () => {
      await onFinalRejectInvoice(no, finalRejectTarget.reason);
      setFinalRejectTarget(null);
    });
  };

  const auditLog = (inv) => (Array.isArray(inv.auditLog) ? inv.auditLog : []);

  return (
    <div className="space-y-8 animate-fade-in" id="topups-view">
      <ErrorBanner error={error} onRetry={onRetry} />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Topup Audits</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Full approval workflow for incoming bKash/EBL payments: approve, reject with reason, collect feedback, and final-review before the top-up is released.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full font-semibold border border-amber-100 dark:border-amber-500/20">
            {activeAudits.length} Pending Audits
          </span>
          <span className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-full font-semibold border border-blue-100 dark:border-blue-500/20">
            {invoices.length} Topup Records
          </span>
        </div>
      </div>

      {/* Audit Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
        <StatCard
          title="AUDITS AWAITING ACTION"
          value={`${activeAudits.length} transactions`}
          variant="amber"
          icon={<Clock size={16} />}
          size="compact"
        />
        <StatCard
          title="TOTAL TOPUPS"
          value={`${invoices.length} records`}
          variant="blue"
          icon={<DollarSign size={16} />}
          size="compact"
        />
        <StatCard
          title="AUDIT SLA GOAL"
          value="< 3 mins Average"
          variant="emerald"
          icon={<ShieldCheck size={16} />}
          size="compact"
        />
      </div>

      {/* Main ledger */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm shadow-slate-100 dark:shadow-none">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topup Ledger &amp; Audit Queue</h3>
          <p className="text-[10px] text-slate-400">
            Pending / Waiting for Feedback / Final Approval Review items are ready for audit actions.
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-blue" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Loading audit queue...</h4>
            <p className="text-xs mt-1">Fetching pending approvals and top-up syncs.</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-16 text-center text-slate-400 dark:text-slate-500">
            <CheckCircle className="mx-auto mb-3 text-emerald-500" size={40} />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Topup Records Yet</h4>
            <p className="text-xs mt-1">Topups created from the Sales page will appear here automatically.</p>
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400 min-w-[980px]" id="topups-table">
              <thead className="bg-slate-50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/80 uppercase text-[10px] tracking-wider">
                <tr>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Invoice ID</th>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Customer / Brand</th>
                  <th scope="col" className="py-2.5 px-3 whitespace-nowrap">Ad Account / Platform</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Topup USD</th>
                  <th scope="col" className="py-2.5 px-3 text-right whitespace-nowrap">Paid BDT / Channel</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Payment Audit</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Topup API</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Screenshot</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Audit Log</th>
                  <th scope="col" className="py-2.5 px-3 text-center whitespace-nowrap">Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/30 text-[11px]">
                {pagedInvoices.map((inv) => {
                  const auditStatus = inv.approvalStatus || 'Pending';
                  const isActiveAudit = ACTIVE_AUDIT_STATES.includes(auditStatus);
                  const needsApiSync = auditStatus === 'Approved' && inv.topupStatus === 'Pending';
                  return (
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
                        <div className="font-semibold text-slate-800 dark:text-slate-200">৳{(inv.paidAmountBDT ?? 0).toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">{inv.paymentMethod}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusTone(auditStatus)}`}>
                          {auditStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          inv.topupStatus === 'Successfull'
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60'
                            : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/60'
                        }`}>
                          {inv.topupStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {inv.paymentScreenshot ? (
                          <button
                            id={`btn-screenshot-${inv.invoiceNo}`}
                            onClick={() => setScreenshotTarget(inv)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors"
                          >
                            <Eye size={12} /> View
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <button
                          id={`btn-log-${inv.invoiceNo}`}
                          onClick={() => setLogTarget(inv)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-800/60 cursor-pointer transition-colors"
                        >
                          <History size={12} /> View Log {auditLog(inv).length > 0 && `(${auditLog(inv).length})`}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {isActiveAudit || needsApiSync ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {auditStatus === 'Pending' && (
                              <>
                                <button
                                  id={`btn-approve-${inv.invoiceNo}`}
                                  onClick={() => runAction(`approve-${inv.invoiceNo}`, () => onApproveInvoice(inv.invoiceNo))}
                                  disabled={busyKey === `approve-${inv.invoiceNo}`}
                                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                                >
                                  {busyKey === `approve-${inv.invoiceNo}` ? (
                                    <>
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                      Approving
                                    </>
                                  ) : (
                                    'Approve'
                                  )}
                                </button>
                                <button
                                  id={`btn-reject-${inv.invoiceNo}`}
                                  onClick={() => setRejectTarget({ invoiceNo: inv.invoiceNo, reason: '' })}
                                  disabled={!!busyKey}
                                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {auditStatus === 'Waiting For Feedback' && (
                              <button
                                id={`btn-feedback-${inv.invoiceNo}`}
                                onClick={() => setFeedbackTarget({ invoiceNo: inv.invoiceNo, feedback: '' })}
                                disabled={!!busyKey}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                              >
                                Submit Feedback
                              </button>
                            )}
                            {auditStatus === 'Final Approval Review' && (
                              <>
                                <button
                                  id={`btn-final-approve-${inv.invoiceNo}`}
                                  onClick={() => runAction(`final-approve-${inv.invoiceNo}`, () => onFinalApproveInvoice(inv.invoiceNo))}
                                  disabled={busyKey === `final-approve-${inv.invoiceNo}`}
                                  className="inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                                >
                                  {busyKey === `final-approve-${inv.invoiceNo}` ? (
                                    <>
                                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                      Approving
                                    </>
                                  ) : (
                                    'Final Approve'
                                  )}
                                </button>
                                <button
                                  id={`btn-final-reject-${inv.invoiceNo}`}
                                  onClick={() => setFinalRejectTarget({ invoiceNo: inv.invoiceNo, reason: '' })}
                                  disabled={!!busyKey}
                                  className="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                                >
                                  Final Reject
                                </button>
                              </>
                            )}
                            {needsApiSync && (
                              <button
                                id={`btn-sync-${inv.invoiceNo}`}
                                onClick={() => runAction(`sync-${inv.invoiceNo}`, () => onSyncTopupStatus(inv.invoiceNo))}
                                disabled={busyKey === `sync-${inv.invoiceNo}`}
                                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] px-2.5 py-1 rounded cursor-pointer active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait"
                              >
                                {busyKey === `sync-${inv.invoiceNo}` ? (
                                  <>
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                                    Syncing
                                  </>
                                ) : (
                                  'Sync API Done'
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                            Settled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Showing {pageStart}–{pageEnd} of {invoices.length} records
              </span>
            </div>
          )}
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </>
        )}
      </div>

      {/* Reject modal */}
      <Modal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title="Reject Audit"
        description={`Reject invoice #${rejectTarget?.invoiceNo ?? ''}? The status will become "Waiting For Feedback" and the customer will be asked for clarification.`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reject Reason *</label>
            <textarea
              id="reject-reason"
              rows={4}
              value={rejectTarget?.reason || ''}
              onChange={(e) => setRejectTarget(prev => prev ? { ...prev, reason: e.target.value } : prev)}
              className={inputClass}
              placeholder="e.g. Payment screenshot does not match the charged amount. Please resubmit with a valid proof of payment."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setRejectTarget(null)}
              disabled={!!busyKey}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyKey === `reject-${rejectTarget?.invoiceNo}` || !rejectTarget?.reason?.trim()}
              onClick={submitReject}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {busyKey === `reject-${rejectTarget?.invoiceNo}` ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                  Rejecting…
                </>
              ) : (
                'Reject &amp; Wait for Feedback'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Feedback modal */}
      <Modal
        isOpen={!!feedbackTarget}
        onClose={() => setFeedbackTarget(null)}
        title="Submit Feedback"
        description={`Record the customer's feedback for invoice #${feedbackTarget?.invoiceNo ?? ''}. This moves the audit to Final Approval Review.`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Feedback *</label>
            <textarea
              id="feedback-text"
              rows={4}
              value={feedbackTarget?.feedback || ''}
              onChange={(e) => setFeedbackTarget(prev => prev ? { ...prev, feedback: e.target.value } : prev)}
              className={inputClass}
              placeholder="e.g. Customer confirmed the payment and resent the correct screenshot."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFeedbackTarget(null)}
              disabled={!!busyKey}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyKey === `feedback-${feedbackTarget?.invoiceNo}` || !feedbackTarget?.feedback?.trim()}
              onClick={submitFeedback}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {busyKey === `feedback-${feedbackTarget?.invoiceNo}` ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                  Submitting…
                </>
              ) : (
                'Submit Feedback'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Final reject modal */}
      <Modal
        isOpen={!!finalRejectTarget}
        onClose={() => setFinalRejectTarget(null)}
        title="Final Reject"
        description={`Finally reject invoice #${finalRejectTarget?.invoiceNo ?? ''}? The status will become "Finally Rejected" and the audit will be closed.`}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reason *</label>
            <textarea
              id="final-reject-reason"
              rows={4}
              value={finalRejectTarget?.reason || ''}
              onChange={(e) => setFinalRejectTarget(prev => prev ? { ...prev, reason: e.target.value } : prev)}
              className={inputClass}
              placeholder="e.g. Payment was never received and the customer did not respond."
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setFinalRejectTarget(null)}
              disabled={!!busyKey}
              className="text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busyKey === `final-reject-${finalRejectTarget?.invoiceNo}` || !finalRejectTarget?.reason?.trim()}
              onClick={submitFinalReject}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {busyKey === `final-reject-${finalRejectTarget?.invoiceNo}` ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/50 border-t-white" />
                  Rejecting…
                </>
              ) : (
                'Finally Reject'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Screenshot modal */}
      <Modal
        isOpen={!!screenshotTarget}
        onClose={() => setScreenshotTarget(null)}
        title={`Payment Screenshot — ${screenshotTarget?.invoiceNo ?? ''}`}
        size="xl"
      >
        {screenshotTarget?.paymentScreenshot ? (
          <div className="space-y-3">
            <img
              src={screenshotTarget.paymentScreenshot}
              alt={`Payment screenshot for ${screenshotTarget.invoiceNo}`}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 object-contain max-h-[60vh]"
            />
            <p className="text-[10px] text-slate-400">Reference proof of payment attached to this topup. Review against the Paid BDT amount before deciding.</p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">No screenshot was attached to this topup.</p>
        )}
      </Modal>

      {/* Audit log modal */}
      <Modal
        isOpen={!!logTarget}
        onClose={() => setLogTarget(null)}
        title={`Audit Log — ${logTarget?.invoiceNo ?? ''}`}
        description="Complete workflow history: creation, approvals, rejections, feedback, and final actions."
        size="xl"
        scrollable
      >
        {logTarget && auditLog(logTarget).length > 0 ? (
          <ol className="relative space-y-4 pl-1">
            {auditLog(logTarget).map((entry, idx) => {
              const meta = ACTION_META[entry.action] || { label: entry.action, icon: <AlertCircle size={13} />, tone: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' };
              const log = auditLog(logTarget);
              const isLast = idx === log.length - 1;
              return (
                <li key={`${entry.at}-${idx}`} className="relative pl-6">
                  {!isLast && (
                    <span className="absolute left-[9px] top-6 bottom-[-16px] w-px bg-slate-200 dark:bg-slate-800" />
                  )}
                  <span className={`absolute left-0 top-0.5 inline-flex items-center justify-center h-[18px] w-[18px] rounded-full border ${meta.tone}`}>
                    {meta.icon}
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.tone}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-400">→ {entry.status}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(entry.at).toLocaleString()}</span>
                  </div>
                  {entry.reason && (
                    <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
                      {entry.reason}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    <ShieldCheck size={11} className="inline mr-1 -mt-0.5" />
                    By <span className="font-semibold text-slate-500 dark:text-slate-300">{formatActor(entry.actor)}</span>
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="text-center py-8">
            <XCircle className="mx-auto mb-2 text-slate-300 dark:text-slate-600" size={28} />
            <p className="text-xs text-slate-500">No audit history recorded for this record.</p>
            <p className="text-[10px] text-slate-400 mt-1">Legacy-synced records pre-date the audit log. New sales capture the full workflow automatically.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default memo(TopupsView);

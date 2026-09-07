import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

const PAGE_LIMIT = 20;
const PENDING_AUDIT_STATES = ['Pending', 'Waiting For Feedback', 'Final Approval Review'];

function isActiveAudit(inv) {
  if (!inv) return false;
  return PENDING_AUDIT_STATES.includes(inv.approvalStatus);
}

export function useTopups(triggerToast) {
  // Only the current server page lives in state — never the full ledger.
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);

  // Dedupe overlapping fetches (e.g. React Strict Mode double-effect in dev):
  // concurrent callers for the same page share one in-flight promise, and
  // stale responses from an older page request never overwrite newer state.
  const inflightRef = useRef(new Map());
  const seqRef = useRef(0);

  const fetchTopups = useCallback(async (targetPage = 1) => {
    const safePage = Number.isFinite(Number(targetPage)) && Number(targetPage) > 0
      ? Math.floor(Number(targetPage))
      : 1;
    const key = `page:${safePage}`;
    const ongoing = inflightRef.current.get(key);
    if (ongoing) return ongoing;

    const seq = seqRef.current + 1;
    seqRef.current = seq;

    const promise = (async () => {
      try {
        const data = await apiFetch(`/api/topups?page=${safePage}&limit=${PAGE_LIMIT}`);
        // Ignore stale responses if a newer page request has started since.
        if (seqRef.current !== seq) return data.items || data.topups || [];
        setInvoices(data.items || data.topups || []);
        setPage(data.page || safePage);
        setTotal(Number(data.total) || 0);
        setTotalPages(Math.max(1, Number(data.totalPages) || 1));
        // Badge parity with the old client-side `activeAudits` count
        // (approvalStatus in active states). Falls back to the legacy
        // `pending` (OR) count when the new key is absent.
        setPendingCount(
          data.activeAudits !== undefined ? Number(data.activeAudits) || 0 : Number(data.pending) || 0
        );
        setError(null);
        return data.items || data.topups || [];
      } catch (err) {
        if (seqRef.current !== seq) throw err;
        setError(err);
        triggerToast('error', 'Load Failed', getErrorMessage(err));
        throw err;
      } finally {
        inflightRef.current.delete(key);
        if (seqRef.current === seq) setLoading(false);
      }
    })();

    inflightRef.current.set(key, promise);
    return promise;
  }, [triggerToast]);

  useEffect(() => {
    fetchTopups(1);
  }, [fetchTopups]);

  const goToPage = useCallback((nextPage) => {
    setLoading(false);
    return fetchTopups(nextPage);
  }, [fetchTopups]);

  // After a workflow action the backend returns the updated row: patch it in
  // place (same as before) and adjust the server-provided pending count
  // locally when the row crosses the pending boundary — no full refetch.
  const patchRow = useCallback((invoiceNo, updated) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.invoiceNo !== invoiceNo) return inv;
      if (isActiveAudit(inv) && !isActiveAudit(updated)) {
        setPendingCount(c => Math.max(0, c - 1));
      } else if (!isActiveAudit(inv) && isActiveAudit(updated)) {
        setPendingCount(c => c + 1);
      }
      return updated;
    }));
  }, []);

  const approveInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/approve`, {
          method: 'PATCH',
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('success', 'Topup Approved', `Invoice ${invoiceNo} approved and settled.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const rejectInvoice = useCallback(
    async (invoiceNo, reason) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason }),
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('warning', 'Topup Rejected', `Invoice ${invoiceNo} rejected. Waiting for feedback.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const submitFeedback = useCallback(
    async (invoiceNo, feedback, screenshot = '') => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/feedback`, {
          method: 'PATCH',
          body: JSON.stringify({ feedback, screenshot }),
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('info', 'Feedback Submitted', `Invoice ${invoiceNo} moved to final approval review.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Feedback Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const finalApproveInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/final-approve`, {
          method: 'PATCH',
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('success', 'Final Approval Granted', `Invoice ${invoiceNo} approved.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Final Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const finalRejectInvoice = useCallback(
    async (invoiceNo, reason) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/final-reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason }),
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('error', 'Finally Rejected', `Invoice ${invoiceNo} finally rejected.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Final Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const syncTopupStatus = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/sync`, {
          method: 'POST',
          body: JSON.stringify({ status: 'Successfull' }),
        });
        patchRow(invoiceNo, data.invoice);
        triggerToast('success', 'Topup Synced', `Invoice ${invoiceNo} marked API-complete.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Topup Sync Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, patchRow],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchTopups(page);
  }, [fetchTopups, page]);

  return {
    invoices,
    loading,
    error,
    page,
    total,
    totalPages,
    pendingCount,
    limit: PAGE_LIMIT,
    goToPage,
    approveInvoice,
    rejectInvoice,
    submitFeedback,
    finalApproveInvoice,
    finalRejectInvoice,
    syncTopupStatus,
    refetch,
  };
}

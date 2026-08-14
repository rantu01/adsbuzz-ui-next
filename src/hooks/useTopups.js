import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useTopups(triggerToast) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTopups = useCallback(async () => {
    try {
      const data = await apiFetch('/api/topups');
      setInvoices(data.topups || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchTopups();
  }, [fetchTopups]);

  const approveInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/approve`, {
          method: 'PATCH',
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('success', 'Topup Approved', `Invoice ${invoiceNo} approved and settled.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const rejectInvoice = useCallback(
    async (invoiceNo, reason) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason }),
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('warning', 'Topup Rejected', `Invoice ${invoiceNo} rejected. Waiting for feedback.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const submitFeedback = useCallback(
    async (invoiceNo, feedback, screenshot = '') => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/feedback`, {
          method: 'PATCH',
          body: JSON.stringify({ feedback, screenshot }),
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('info', 'Feedback Submitted', `Invoice ${invoiceNo} moved to final approval review.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Feedback Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const finalApproveInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/final-approve`, {
          method: 'PATCH',
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('success', 'Final Approval Granted', `Invoice ${invoiceNo} approved.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Final Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const finalRejectInvoice = useCallback(
    async (invoiceNo, reason) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/final-reject`, {
          method: 'PATCH',
          body: JSON.stringify({ reason }),
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('error', 'Finally Rejected', `Invoice ${invoiceNo} finally rejected.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Final Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const syncTopupStatus = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/sync`, {
          method: 'POST',
          body: JSON.stringify({ status: 'Successfull' }),
        });
        setInvoices(prev => prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)));
        triggerToast('success', 'Topup Synced', `Invoice ${invoiceNo} marked API-complete.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Topup Sync Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchTopups();
  }, [fetchTopups]);

  return {
    invoices,
    loading,
    error,
    approveInvoice,
    rejectInvoice,
    submitFeedback,
    finalApproveInvoice,
    finalRejectInvoice,
    syncTopupStatus,
    refetch,
  };
}
import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useInvoices(triggerToast) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Collection-wide aggregates (totals/counts) for the dashboard fallback. The
  // paged views fetch their own aggregates alongside each page.
  const [aggregates, setAggregates] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      // `limit=0` asks the API for the full ledger in a SINGLE request (no more
      // page-by-page loop that pulled the entire collection repeatedly). The
      // analytics pages (Reports/Insights/Customers/Topups/Dashboard) still need
      // every record for their cross-record math, so this stays a full load.
      const data = await apiFetch("/api/invoices?limit=0");
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
      setAggregates(data.aggregates || null);
      setError(null);
    } catch (err) {
      setError(err);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const addInvoice = useCallback(
    async (invoice) => {
      try {
        const data = await apiFetch('/api/invoices', {
          method: 'POST',
          body: JSON.stringify(invoice),
        });
        setInvoices(prev => [data.invoice, ...prev]);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Sale Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const addHistoricalInvoice = useCallback(
    async (invoice) => {
      try {
        const data = await apiFetch('/api/invoices/historical', {
          method: 'POST',
          body: JSON.stringify(invoice),
        });
        setInvoices(prev => [data.invoice, ...prev]);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Historical Sale Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateInvoice = useCallback(
    async (updatedInv) => {
      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(updatedInv.invoiceNo)}`, {
          method: 'PUT',
          body: JSON.stringify(updatedInv),
        });
        setInvoices(prev =>
          prev.map(inv => (inv.invoiceNo === data.invoice.invoiceNo ? data.invoice : inv)),
        );
        triggerToast('success', 'Invoice Updated', `Invoice ${data.invoice.invoiceNo} updated.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Invoice Update Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const approveInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceNo)}/approve`, {
          method: 'PATCH',
        });
        setInvoices(prev =>
          prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)),
        );
        triggerToast('success', 'Invoice Approved', `Invoice ${invoiceNo} approved.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const rejectInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceNo)}/reject`, {
          method: 'PATCH',
        });
        setInvoices(prev =>
          prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)),
        );
        triggerToast('warning', 'Invoice Rejected', `Invoice ${invoiceNo} rejected.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const syncTopupStatus = useCallback(
    async (invoiceNo, status) => {
      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceNo)}/sync-topup`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        setInvoices(prev =>
          prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)),
        );
        triggerToast('success', 'Topup Synced', `Invoice ${invoiceNo} topup status: ${status}.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Topup Sync Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const deleteInvoice = useCallback(
    async (invoiceNo) => {
      const prev = invoices.find(inv => inv.invoiceNo === invoiceNo);
      if (!prev) return null;

      setInvoices(prevList => prevList.filter(inv => inv.invoiceNo !== invoiceNo));

      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceNo)}`, {
          method: 'DELETE',
        });
        const removed = data.invoice;
        triggerToast('info', 'Sales Entry Deleted', `Invoice ${removed.invoiceNo} removed from Sales Entry Records.`);
        return removed;
      } catch (err) {
        setInvoices(prevList =>
          prevList.some(inv => inv.invoiceNo === invoiceNo) ? prevList : [prev, ...prevList],
        );
        triggerToast('error', 'Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [invoices, triggerToast],
  );

  const recordPayment = useCallback(
    async (invoiceNo, payload) => {
      try {
        const data = await apiFetch(`/api/invoices/${encodeURIComponent(invoiceNo)}/pay`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setInvoices(prev =>
          prev.map(inv => (inv.invoiceNo === invoiceNo ? data.invoice : inv)),
        );
        triggerToast(
          'success',
          'Payment Recorded',
          `৳${Number(payload.amountBDT || 0).toLocaleString()} recorded against invoice ${invoiceNo}.`,
        );
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Payment Recording Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  return {
    invoices,
    loading,
    error,
    aggregates,
    addInvoice,
    addHistoricalInvoice,
    updateInvoice,
    approveInvoice,
    rejectInvoice,
    syncTopupStatus,
    deleteInvoice,
    recordPayment,
    refetch: fetchInvoices,
  };
}

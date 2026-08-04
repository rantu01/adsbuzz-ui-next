import { useCallback, useEffect, useState } from 'react';
import { INITIAL_INVOICES } from '@/data/seedData';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useInvoices(triggerToast) {
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const data = await apiFetch('/api/invoices');
      if (Array.isArray(data.invoices) && data.invoices.length > 0) {
        setInvoices(data.invoices);
      }
      setError(null);
    } catch (err) {
      setError(err);
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

  return {
    invoices,
    loading,
    error,
    addInvoice,
    updateInvoice,
    approveInvoice,
    rejectInvoice,
    syncTopupStatus,
    refetch: fetchInvoices,
  };
}

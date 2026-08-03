import { useCallback, useEffect, useState } from 'react';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

export function useTopups(triggerToast) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTopups = useCallback(async () => {
    try {
      const data = await apiFetch('/api/topups');
      setInvoices(data.topups || []);
    } catch (err) {
      triggerToast('error', 'Load Failed', err.message);
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
        setInvoices(prev => prev.filter(inv => inv.invoiceNo !== invoiceNo));
        triggerToast('success', 'Topup Approved', `Invoice ${invoiceNo} approved and settled.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Approval Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const rejectInvoice = useCallback(
    async (invoiceNo) => {
      try {
        const data = await apiFetch(`/api/topups/${encodeURIComponent(invoiceNo)}/reject`, {
          method: 'PATCH',
        });
        setInvoices(prev => prev.filter(inv => inv.invoiceNo !== invoiceNo));
        triggerToast('warning', 'Topup Rejected', `Invoice ${invoiceNo} rejected.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Rejection Failed', err.message);
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
        setInvoices(prev => prev.filter(inv => inv.invoiceNo !== invoiceNo));
        triggerToast('success', 'Topup Synced', `Invoice ${invoiceNo} marked API-complete.`);
        return data.invoice;
      } catch (err) {
        triggerToast('error', 'Topup Sync Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  return {
    invoices,
    loading,
    approveInvoice,
    rejectInvoice,
    syncTopupStatus,
    refetch: fetchTopups,
  };
}
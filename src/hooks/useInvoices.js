import { useCallback, useEffect, useState } from 'react';
import { INITIAL_INVOICES } from '@/data/seedData';

export function useInvoices(triggerToast) {
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/invoices');
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          throw new Error(data?.message || `Request failed (${res.status})`);
        }
        if (Array.isArray(data.invoices) && data.invoices.length > 0) {
          setInvoices(data.invoices);
        }
        setError(null);
      } catch (err) {
        if (active) setError(err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const addInvoice = useCallback((invoice) => {
    setInvoices(prev => [invoice, ...prev]);
  }, []);

  const updateInvoice = useCallback(
    (updatedInv) => {
      setInvoices(prev =>
        prev.map(inv => (inv.invoiceNo === updatedInv.invoiceNo ? updatedInv : inv)),
      );
      triggerToast('success', 'Invoice Updated', `Invoice ${updatedInv.invoiceNo} updated.`);
    },
    [triggerToast],
  );

  const approveInvoice = useCallback(
    (invoiceNo) => {
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNo === invoiceNo
            ? { ...inv, approvalStatus: 'Approved', paymentStatus: 'Paid' }
            : inv,
        ),
      );
      triggerToast('success', 'Invoice Approved', `Invoice ${invoiceNo} approved.`);
    },
    [triggerToast],
  );

  const rejectInvoice = useCallback(
    (invoiceNo) => {
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNo === invoiceNo
            ? { ...inv, approvalStatus: 'Rejected', paymentStatus: 'Due' }
            : inv,
        ),
      );
      triggerToast('warning', 'Invoice Rejected', `Invoice ${invoiceNo} rejected.`);
    },
    [triggerToast],
  );

  const syncTopupStatus = useCallback(
    (invoiceNo, status) => {
      setInvoices(prev =>
        prev.map(inv =>
          inv.invoiceNo === invoiceNo
            ? { ...inv, topupStatus: status }
            : inv,
        ),
      );
      triggerToast('success', 'Topup Synced', `Invoice ${invoiceNo} topup status: ${status}.`);
    },
    [triggerToast],
  );

  return { invoices, loading, error, addInvoice, updateInvoice, approveInvoice, rejectInvoice, syncTopupStatus };
}

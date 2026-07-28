import { useCallback, useState } from 'react';
import { INITIAL_INVOICES } from '@/data/seedData';

export function useInvoices(triggerToast) {
  const [invoices, setInvoices] = useState(INITIAL_INVOICES);

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

  return { invoices, addInvoice, updateInvoice, approveInvoice, rejectInvoice, syncTopupStatus };
}
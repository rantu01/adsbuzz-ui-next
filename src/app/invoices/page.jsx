'use client';

import { useApp } from '@/context/AppContext';
import InvoicesView from '@/components/views/InvoicesView';

export default function InvoicesPage() {
  const app = useApp();

  return (
    <InvoicesView
      invoices={app.invoices}
      loading={app.invoicesLoading}
      error={app.invoicesError}
      onRetry={app.refetchInvoices}
      customers={app.customers}
      paymentMethods={app.settings.paymentMethods}
      onUpdateInvoice={app.handleUpdateInvoice}
      onRecordPayment={app.handleRecordInvoicePayment}
    />
  );
}

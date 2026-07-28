'use client';

import { useApp } from '@/context/AppContext';
import InvoicesView from '@/components/views/InvoicesView';

export default function InvoicesPage() {
  const app = useApp();

  return (
    <InvoicesView
      invoices={app.invoices}
      customers={app.customers}
      onUpdateInvoice={app.handleUpdateInvoice}
    />
  );
}

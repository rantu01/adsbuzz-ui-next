'use client';

import { useApp } from '@/context/AppContext';
import TopupsView from '@/components/views/TopupsView';

export default function TopupsPage() {
  const app = useApp();

  return (
    <TopupsView
      invoices={app.invoices}
      customers={app.customers}
      onApproveInvoice={app.handleApproveInvoice}
      onRejectInvoice={app.handleRejectInvoice}
      onSyncTopupStatus={app.handleSyncTopupStatus}
    />
  );
}

'use client';

import { useApp } from '@/context/AppContext';
import TopupsView from '@/components/views/TopupsView';
import { useTopups } from '@/hooks/useTopups';

export default function TopupsPage() {
  const app = useApp();
  const {
    invoices,
    approveInvoice,
    rejectInvoice,
    syncTopupStatus,
  } = useTopups(app.triggerToast);

  return (
    <TopupsView
      invoices={invoices}
      customers={app.customers}
      onApproveInvoice={approveInvoice}
      onRejectInvoice={rejectInvoice}
      onSyncTopupStatus={syncTopupStatus}
    />
  );
}
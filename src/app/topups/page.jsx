'use client';

import { useApp } from '@/context/AppContext';
import TopupsView from '@/components/views/TopupsView';
import { useTopups } from '@/hooks/useTopups';

export default function TopupsPage() {
  const app = useApp();
  const {
    invoices,
    loading,
    error,
    approveInvoice,
    rejectInvoice,
    syncTopupStatus,
    refetch,
  } = useTopups(app.triggerToast);

  return (
    <TopupsView
      invoices={invoices}
      loading={loading}
      error={error}
      onRetry={refetch}
      customers={app.customers}
      onApproveInvoice={approveInvoice}
      onRejectInvoice={rejectInvoice}
      onSyncTopupStatus={syncTopupStatus}
    />
  );
}
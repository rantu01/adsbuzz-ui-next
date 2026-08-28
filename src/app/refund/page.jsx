'use client';

import { useApp } from '@/context/AppContext';
import RefundsView from '@/components/views/RefundsView';

export default function RefundPage() {
  const app = useApp();
  return (
    <RefundsView
      refunds={app.refunds}
      refundSummary={app.refundSummary}
      refundsError={app.refundsError}
      paymentMethods={app.settings?.paymentMethods || []}
      defaultDollarRate={app.settings?.defaultDollarRate}
      onRetry={app.refetchRefunds}
      onAddRefund={app.handleAddRefund}
      onUpdateRefund={app.handleUpdateRefund}
      onDeleteRefund={app.handleDeleteRefund}
    />
  );
}

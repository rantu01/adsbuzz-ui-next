'use client';

import { Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { useSearchParams } from 'next/navigation';
import AdAccountsView from '@/components/views/AdAccountsView';

function AdAccountsPageInner() {
  const searchParams = useSearchParams();
  const app = useApp();

  const autoOpenAdd = searchParams.get('autoOpenAdd') === 'true';

  return (
    <AdAccountsView
      adAccounts={app.adAccounts}
      customers={app.customers}
      cards={app.cards}
      series={app.series}
      onAddAdAccount={app.handleAddAdAccount}
      onUpdateAdAccount={app.handleUpdateAdAccount}
      onUpdateAccountStatus={app.handleUpdateAccountStatus}
      onBulkUpdateStatus={app.handleBulkUpdateStatus}
      autoOpenAddModal={autoOpenAdd || app.pendingOpenAddAccount}
    />
  );
}

export default function AdAccountsPage() {
  return (
    <Suspense fallback={null}>
      <AdAccountsPageInner />
    </Suspense>
  );
}
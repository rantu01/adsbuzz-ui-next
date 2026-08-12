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
      socialAdAccounts={app.socialAdAccounts}
      error={app.adAccountsError}
      onRetry={app.refetchAdAccounts}
      customers={app.customers}
      cards={app.cards}
      series={app.series}
      onAddAdAccount={app.handleAddAdAccount}
      onAddSocialAdAccount={app.handleAddSocialAdAccount}
      onUpdateAdAccount={app.handleUpdateAdAccount}
      onUpdateSocialAdAccount={app.handleUpdateSocialAdAccount}
      onDeleteAdAccount={app.handleDeleteAdAccount}
      onDeleteSocialAdAccount={app.handleDeleteSocialAdAccount}
       onAssignAdAccount={app.handleAssignAdAccount}
       onUnassignAdAccount={app.handleUnassignAdAccount}
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
'use client';

import { Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import CustomersView from '@/components/views/CustomersView';

function CustomersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const app = useApp();

  const autoOpenAdd = searchParams.get('autoOpenAdd') === 'true';
  const initialCustomerId = searchParams.get('customerId');

  return (
    <CustomersView
      customers={app.customers}
      loading={app.customersLoading}
      error={app.customersError}
      onRetry={app.refetchCustomers}
      adAccounts={app.adAccounts}
      invoices={app.invoices}
      onAddCustomer={app.handleAddCustomer}
      onUpdateCustomer={app.handleUpdateCustomer}
      onUpdateCustomerNotes={app.handleUpdateCustomerNotes}
      onToggleFavorite={app.handleToggleFavorite}
      onTriggerTopup={app.handleTriggerTopup}
      onTriggerAssign={app.handleTriggerAssign}
      autoOpenAddModal={autoOpenAdd || app.pendingOpenAddCustomer}
      initialCustomerId={initialCustomerId || app.pendingInitialCustomerId || undefined}
    />
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={null}>
      <CustomersPageInner />
    </Suspense>
  );
}
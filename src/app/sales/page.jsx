'use client';

import { Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter, useSearchParams } from 'next/navigation';
import SalesView from '@/components/views/SalesView';

function SalesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const app = useApp();

  const initialStep = searchParams.get('step');
  const initialCustomerId = searchParams.get('customerId');

  return (
    <SalesView
      customers={app.customers}
      adAccounts={app.adAccounts}
      socialAdAccounts={app.socialAdAccounts}
      invoices={app.invoices}
      setups={app.setups}
      paymentMethods={app.settings.paymentMethods}
      onSubmitSale={app.handleExecuteSale}
      onAddHistoricalSale={app.handleAddHistoricalSale}
      onUpdateInvoice={app.handleUpdateInvoice}
      onDeleteInvoice={app.handleDeleteInvoice}
      onAddCustomer={app.handleAddCustomer}
      onNavigateToCustomers={app.handleNavigateToCustomers}
      loading={app.invoicesLoading}
      defaultDollarRate={app.settings.defaultDollarRate}
      initialCheckoutStep={initialStep ? Number(initialStep) : undefined}
      initialCustomerId={initialCustomerId || undefined}
    />
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={null}>
      <SalesPageInner />
    </Suspense>
  );
}
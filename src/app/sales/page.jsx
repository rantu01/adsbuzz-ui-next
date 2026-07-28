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
      invoices={app.invoices}
      paymentMethods={app.settings.paymentMethods}
      onSubmitSale={app.handleExecuteSale}
      onUpdateInvoice={app.handleUpdateInvoice}
      onAddCustomer={app.handleAddCustomer}
      onNavigateToCustomers={app.handleNavigateToCustomers}
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
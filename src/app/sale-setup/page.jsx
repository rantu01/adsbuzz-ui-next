'use client';

import { useApp } from '@/context/AppContext';
import SaleSetupView from '@/components/views/SaleSetupView';

export default function SaleSetupPage() {
  const app = useApp();

  return (
    <SaleSetupView
      setups={app.setups}
      customers={app.customers}
      adAccounts={app.adAccounts}
      customersLoading={app.customersLoading}
      adAccountsLoading={app.adAccountsLoading}
      onUpdateSetup={app.handleUpdateSaleSetup}
      onAddSetup={app.addSetup}
    />
  );
}

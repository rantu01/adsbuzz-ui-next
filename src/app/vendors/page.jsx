'use client';

import { useApp } from '@/context/AppContext';
import VendorsView from '@/components/views/VendorsView';

export default function VendorsPage() {
  const app = useApp();

  return (
    <VendorsView
      vendors={app.vendors}
      error={app.vendorsError}
      onRetry={app.refetchVendors}
      onUpdateVendor={app.handleUpdateVendor}
      onAddVendor={app.addVendor}
      onPayVendor={app.handlePayVendor}
      onDeleteVendor={app.handleDeleteVendor}
      paymentMethods={app.settings.paymentMethods}
    />
  );
}

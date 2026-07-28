'use client';

import { useApp } from '@/context/AppContext';
import VendorsView from '@/components/views/VendorsView';

export default function VendorsPage() {
  const app = useApp();

  return (
    <VendorsView
      vendors={app.vendors}
      onUpdateVendor={app.handleUpdateVendor}
      onAddVendor={app.addVendor}
      paymentMethods={app.settings.paymentMethods}
    />
  );
}

'use client';

import { useApp } from '@/context/AppContext';
import SettingsView from '@/components/views/SettingsView';

export default function SettingsPage() {
  const app = useApp();

  return (
    <SettingsView
      settings={app.settings}
      onUpdateBaseRate={app.handleUpdateBaseRate}
      onAddPaymentMethod={app.handleAddPaymentMethod}
      onDeletePaymentMethod={app.handleDeletePaymentMethod}
    />
  );
}

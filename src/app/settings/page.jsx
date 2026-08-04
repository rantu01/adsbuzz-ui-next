'use client';

import { useApp } from '@/context/AppContext';
import SettingsView from '@/components/views/SettingsView';

export default function SettingsPage() {
  const app = useApp();

  return (
    <SettingsView
      settings={app.settings}
      error={app.settingsError}
      onRetry={app.refetchSettings}
      onUpdateBaseRate={app.handleUpdateBaseRate}
      onAddPaymentMethod={app.handleAddPaymentMethod}
      onDeletePaymentMethod={app.handleDeletePaymentMethod}
    />
  );
}

'use client';

import { useApp } from '@/context/AppContext';
import DashboardView from '@/components/views/DashboardView';

export default function DashboardPage() {
  const app = useApp();

  return (
    <DashboardView
      stats={app.stats}
      invoices={app.invoices}
      customers={app.customers}
      adAccounts={app.adAccounts}
      series={app.series}
      activities={app.activities}
      onNavigate={app.handleNavigate}
      onQuickAction={app.handleQuickAction}
      onSelectInsightsAccount={app.setSelectedInsightsAccountId}
    />
  );
}
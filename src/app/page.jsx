'use client';

import { useApp } from '@/context/AppContext';
import DashboardView from '@/components/views/DashboardView';
import { useDashboard } from '@/hooks/useDashboard';

export default function DashboardPage() {
  const app = useApp();
  const { stats: serverStats, dashboard } = useDashboard();

  const stats = serverStats || app.stats;
  const activities = dashboard?.recentActivities || app.activities;

  return (
    <DashboardView
      stats={stats}
      invoices={app.invoices}
      customers={app.customers}
      adAccounts={app.adAccounts}
      series={app.series}
      activities={activities}
      onNavigate={app.handleNavigate}
      onQuickAction={app.handleQuickAction}
      onSelectInsightsAccount={app.setSelectedInsightsAccountId}
    />
  );
}
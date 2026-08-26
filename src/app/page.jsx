'use client';

import { useApp } from '@/context/AppContext';
import DashboardView from '@/components/views/DashboardView';
import { useDashboard } from '@/hooks/useDashboard';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const app = useApp();
  const { stats: serverStats, dashboard, error: dashboardError, refetch: refetchDashboard } = useDashboard();

  const stats = serverStats || app.stats;
  const activities = dashboard?.recentActivities || app.activities;

  return (
    <DashboardView
      stats={stats}
      error={dashboardError}
      onRetry={refetchDashboard}
      invoices={app.invoices}
      customers={app.customers}
      adAccounts={app.socialAdAccounts}
      series={app.series}
      activities={activities}
      onNavigate={app.handleNavigate}
      onQuickAction={app.handleQuickAction}
      onSelectInsightsAccount={app.setSelectedInsightsAccountId}
    />
  );
}
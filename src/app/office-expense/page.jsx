'use client';
import { useApp } from '@/context/AppContext';
import OfficeExpenseDashboardView from '@/components/views/OfficeExpenseDashboardView';

export default function OfficeExpenseDashboardPage() {
  const app = useApp();
  return (
    <OfficeExpenseDashboardView
      officeExpenses={app.officeExpenses}
      onRetry={app.refetchOfficeExpenses}
    />
  );
}

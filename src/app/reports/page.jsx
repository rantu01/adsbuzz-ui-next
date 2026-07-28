'use client';

import { useApp } from '@/context/AppContext';
import ReportsView from '@/components/views/ReportsView';

export default function ReportsPage() {
  const app = useApp();

  return (
    <ReportsView
      invoices={app.invoices}
      onTriggerExport={app.handleTriggerExport}
    />
  );
}

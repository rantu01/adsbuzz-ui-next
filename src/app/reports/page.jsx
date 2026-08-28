'use client';

import { useApp } from '@/context/AppContext';
import ReportsView from '@/components/views/ReportsView';

export default function ReportsPage() {
  const app = useApp();
  const { invoices, invoicesLoading, handleTriggerExport, handleDownloadAdAccountStatement } = app;

  return (
    <ReportsView
      invoices={invoices}
      invoicesLoading={invoicesLoading}
      onTriggerExport={handleTriggerExport}
      onDownloadAdAccountStatement={handleDownloadAdAccountStatement}
    />
  );
}

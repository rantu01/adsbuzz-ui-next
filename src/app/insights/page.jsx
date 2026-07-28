'use client';

import { useApp } from '@/context/AppContext';
import InsightsView from '@/components/views/InsightsView';

export default function InsightsPage() {
  const app = useApp();

  return (
    <InsightsView
      invoices={app.invoices}
      adAccounts={app.adAccounts}
      vendors={app.vendors}
      cards={app.cards}
      series={app.series}
      selectedAccId={app.selectedInsightsAccountId}
      onSelectAccId={app.setSelectedInsightsAccountId}
    />
  );
}

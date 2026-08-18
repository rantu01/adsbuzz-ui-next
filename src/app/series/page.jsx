'use client';

import { useApp } from '@/context/AppContext';
import SeriesView from '@/components/views/SeriesView';

export default function SeriesPage() {
  const app = useApp();

  return (
    <SeriesView
      series={app.series}
      error={app.seriesError}
      onRetry={app.refetchSeries}
      adAccounts={app.adAccounts}
      socialAdAccounts={app.socialAdAccounts}
      onUpdateSeries={app.handleUpdateSeries}
      onAddSeries={app.addSeries}
      onDeleteSeries={app.handleDeleteSeries}
    />
  );
}

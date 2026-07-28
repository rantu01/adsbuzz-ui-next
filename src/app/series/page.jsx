'use client';

import { useApp } from '@/context/AppContext';
import SeriesView from '@/components/views/SeriesView';

export default function SeriesPage() {
  const app = useApp();

  return (
    <SeriesView
      series={app.series}
      adAccounts={app.adAccounts}
      onUpdateSeries={app.handleUpdateSeries}
      onAddSeries={app.addSeries}
    />
  );
}

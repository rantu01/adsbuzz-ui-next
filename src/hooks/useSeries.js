import { useCallback, useState } from 'react';
import { INITIAL_SERIES } from '@/data/seedData';

export function useSeries(triggerToast) {
  const [series, setSeries] = useState(INITIAL_SERIES);

  const addSeries = useCallback(
    (seriesData) => {
      setSeries(prev => [...prev, seriesData]);
      triggerToast('success', 'Series Added', `${seriesData.seriesName} has been created.`);
    },
    [triggerToast],
  );

  const updateSeries = useCallback(
    (id, updates) => {
      setSeries(prev => prev.map(s => s.seriesId === id ? { ...s, ...updates } : s));
      triggerToast('success', 'Series Updated', 'Changes saved.');
    },
    [triggerToast],
  );

  return { series, addSeries, updateSeries };
}
import { useCallback, useEffect, useState } from 'react';

export function useSeries(triggerToast) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSeries = useCallback(async () => {
    try {
      const res = await fetch('/api/series');
      if (!res.ok) throw new Error('Failed to load series');
      const data = await res.json();
      setSeries(data.series || []);
    } catch (err) {
      triggerToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const addSeries = useCallback(
    (seriesData) => {
      fetch('/api/series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seriesData),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to create series');
          }
          return res.json();
        })
        .then((data) => {
          setSeries(prev => [...prev, data.series]);
          triggerToast('success', 'Series Added', `${data.series.seriesName} has been created.`);
        })
        .catch((err) => triggerToast('error', 'Failed to Add Series', err.message));
    },
    [triggerToast],
  );

  const updateSeries = useCallback(
    (id, updates) => {
      const seriesObj = typeof id === 'object' ? id : { seriesId: id, ...updates };
      fetch(`/api/series/${seriesObj.seriesId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seriesObj),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to update series');
          }
          return res.json();
        })
        .then((data) => {
          setSeries(prev =>
            prev.map(s => (s.seriesId === seriesObj.seriesId ? data.series : s)),
          );
          triggerToast('success', 'Series Updated', 'Changes saved.');
        })
        .catch((err) => triggerToast('error', 'Failed to Update Series', err.message));
    },
    [triggerToast],
  );

  return { series, loading, addSeries, updateSeries };
}
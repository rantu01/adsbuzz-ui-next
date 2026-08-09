import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useSeries(triggerToast) {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSeries = useCallback(async () => {
    try {
      const data = await apiFetch('/api/series');
      setSeries(data.series || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const addSeries = useCallback(
    async (seriesData) => {
      try {
        const data = await apiFetch('/api/series', {
          method: 'POST',
          body: JSON.stringify(seriesData),
        });
        setSeries(prev => [...prev, data.series]);
        triggerToast('success', 'Series Added', `${data.series.seriesName} has been created.`);
        return data.series;
      } catch (err) {
        triggerToast('error', 'Failed to Add Series', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateSeries = useCallback(
    async (objOrId, updates) => {
      const seriesObj = typeof objOrId === 'object' ? objOrId : { seriesId: objOrId, ...updates };

      // Optimistic update, roll back on failure
      const prev = series.find(s => s.seriesId === seriesObj.seriesId);
      if (prev) setSeries(prevS => prevS.map(s => (s.seriesId === seriesObj.seriesId ? { ...s, ...seriesObj } : s)));

      try {
        const data = await apiFetch(`/api/series/${encodeURIComponent(seriesObj.seriesId)}`, {
          method: 'PATCH',
          body: JSON.stringify(seriesObj),
        });
        const saved = data.series;
        setSeries(prevS => prevS.map(s => (s.seriesId === saved.seriesId ? saved : s)));
        triggerToast('success', 'Series Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setSeries(prevS => prevS.map(s => (s.seriesId === seriesObj.seriesId ? prev : s)));
        triggerToast('error', 'Failed to Update Series', getErrorMessage(err));
        throw err;
      }
    },
    [series, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchSeries();
  }, [fetchSeries]);

  const deleteSeries = useCallback(
    async (seriesId) => {
      const prev = series.find(s => s.seriesId === seriesId);
      if (!prev) return null;

      setSeries(prevS => prevS.filter(s => s.seriesId !== seriesId));

      try {
        const data = await apiFetch(`/api/series/${encodeURIComponent(seriesId)}`, {
          method: 'DELETE',
        });
        const removed = data.series;
        triggerToast('info', 'Series Removed', `${removed.seriesName} (${removed.seriesId}) was deleted.`);
        return removed;
      } catch (err) {
        setSeries(prevS =>
          prevS.some(s => s.seriesId === seriesId) ? prevS : [prev, ...prevS],
        );
        triggerToast('error', 'Series Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [series, triggerToast],
  );

  return { series, loading, error, addSeries, updateSeries, deleteSeries, refetch };
}
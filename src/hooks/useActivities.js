import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

export function useActivities(customerId = "") {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (customerId) qs.set("customerId", customerId);
      const data = await apiFetch(`/api/activities?${qs.toString()}`);
      setActivities(data.activities || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const addActivity = useCallback(async (activity) => {
    try {
      const data = await apiFetch('/api/activities', {
        method: 'POST',
        body: JSON.stringify(activity),
      });
      const created = data.activity;
      setActivities(prev => [created, ...prev]);
      return created;
    } catch (err) {
      // silent — activity logging must never break the primary mutation
      return null;
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, addActivity, refetch };
}

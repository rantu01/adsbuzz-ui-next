import { useCallback, useEffect, useState } from 'react';

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || `Request failed (${res.status})`);
  }
  return data;
}

export function useActivities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const data = await apiFetch('/api/activities');
      setActivities(data.activities || []);
    } catch (err) {
      // silent — activity feed is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

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

  return { activities, loading, addActivity, refetch: fetchActivities };
}

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

export function useDashboard() {
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await apiFetch('/api/dashboard');
      setDashboard(data.dashboard || null);
      setStats(data.dashboard?.stats || null);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchDashboard();
  }, [fetchDashboard]);

  return { stats, dashboard, loading, error, refetch };
}
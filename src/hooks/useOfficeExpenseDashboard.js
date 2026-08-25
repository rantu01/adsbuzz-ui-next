import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useOfficeExpenseDashboard(year) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const search = year ? `?year=${encodeURIComponent(year)}` : '';
      const data = await apiFetch(`/api/office-expense-dashboard${search}`);
      setDashboard(data.dashboard);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { dashboard, loading, error, refetch: fetchDashboard };
}

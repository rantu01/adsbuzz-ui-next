import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

// Single server-aggregated fetch for the whole Office Expense Dashboard.
// No year param: the response already contains every year/month breakdown,
// so changing filters never triggers another request.
export function useOfficeExpenseOverview(triggerToast) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await apiFetch('/api/office-expense-dashboard');
      setOverview(data.overview || null);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast?.('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchOverview();
  }, [fetchOverview]);

  return { overview, loading, error, refetch };
}

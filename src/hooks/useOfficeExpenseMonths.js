import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useOfficeExpenseMonths(triggerToast) {
  const [months, setMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMonths = useCallback(async () => {
    try {
      const data = await apiFetch('/api/office-expense-months');
      setMonths(data.months || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  const addMonth = useCallback(
    async (monthData) => {
      try {
        const data = await apiFetch('/api/office-expense-months', {
          method: 'POST',
          body: JSON.stringify(monthData),
        });
        setMonths((prev) => [...prev, data.month].sort((a, b) => a.month.localeCompare(b.month)));
        triggerToast('success', 'Month Added', `${data.month.month} created.`);
        return data.month;
      } catch (err) {
        triggerToast('error', 'Failed to Add Month', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateMonth = useCallback(
    async (monthCode, updates) => {
      try {
        const data = await apiFetch(`/api/office-expense-months/${encodeURIComponent(monthCode)}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        });
        setMonths((prev) => prev.map((m) => (m.month === monthCode ? data.month : m)));
        triggerToast('success', 'Month Updated', 'Changes saved.');
        return data.month;
      } catch (err) {
        triggerToast('error', 'Failed to Update Month', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchMonths();
  }, [fetchMonths]);

  return { months, loading, error, addMonth, updateMonth, refetch };
}

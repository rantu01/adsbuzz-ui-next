import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

/**
 * Fetches the activity / history trail scoped to a single customer.
 * Returns the full journey of account assignments, top-ups, edits, etc.
 */
export function useCustomerActivities(customerId, triggerToast) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchActivities = useCallback(async () => {
    if (!customerId) {
      setActivities([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('customerId', customerId);
      qs.set('limit', '500');
      const data = await apiFetch(`/api/activities?${qs.toString()}`);
      setActivities(data.activities || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast?.('error', 'Activity Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [customerId, triggerToast]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refetch: fetchActivities };
}

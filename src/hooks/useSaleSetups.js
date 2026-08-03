import { useCallback, useEffect, useState } from 'react';
import { INITIAL_SETUPS } from '@/data/seedData';

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

export function useSaleSetups(triggerToast) {
  const [setups, setSetups] = useState(INITIAL_SETUPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSetups = useCallback(async () => {
    try {
      const data = await apiFetch('/api/sale-setups');
      if (Array.isArray(data.setups) && data.setups.length > 0) {
        setSetups(data.setups);
      }
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSetups();
  }, [fetchSetups]);

  const addSetup = useCallback(
    async (setupData) => {
      try {
        const data = await apiFetch('/api/sale-setups', {
          method: 'POST',
          body: JSON.stringify(setupData),
        });
        setSetups(prev => [data.setup, ...prev]);
        triggerToast('success', 'Sale Setup Created', 'New campaign setup saved.');
        return data.setup;
      } catch (err) {
        triggerToast('error', 'Failed to Create Setup', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const updateSaleSetup = useCallback(
    async (objOrId, updates) => {
      const setupObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      try {
        const data = await apiFetch(`/api/sale-setups/${encodeURIComponent(setupObj.id)}`, {
          method: 'PUT',
          body: JSON.stringify(setupObj),
        });
        setSetups(prev => prev.map(s => (s.id === data.setup.id ? data.setup : s)));
        triggerToast('success', 'Sale Setup Updated', 'Changes saved.');
        return data.setup;
      } catch (err) {
        triggerToast('error', 'Failed to Update Setup', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  return { setups, loading, error, addSetup, updateSaleSetup };
}

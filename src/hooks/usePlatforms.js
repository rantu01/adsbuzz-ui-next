import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function usePlatforms(triggerToast) {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlatforms = useCallback(async () => {
    try {
      const data = await apiFetch('/api/platforms');
      setPlatforms(data.platforms || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  const addPlatform = useCallback(
    async (platformData) => {
      try {
        const data = await apiFetch('/api/platforms', {
          method: 'POST',
          body: JSON.stringify(platformData),
        });
        setPlatforms(prev => [...prev, data.platform]);
        triggerToast('success', 'Platform Added', `${data.platform.platformName} has been created.`);
        return data.platform;
      } catch (err) {
        triggerToast('error', 'Failed to Add Platform', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updatePlatform = useCallback(
    async (objOrId, updates) => {
      const platformObj = typeof objOrId === 'object' ? objOrId : { platformId: objOrId, ...updates };

      const prev = platforms.find(p => p.platformId === platformObj.platformId);
      if (prev) setPlatforms(prevP => prevP.map(p => (p.platformId === platformObj.platformId ? { ...p, ...platformObj } : p)));

      try {
        const data = await apiFetch(`/api/platforms/${encodeURIComponent(platformObj.platformId)}`, {
          method: 'PATCH',
          body: JSON.stringify(platformObj),
        });
        const saved = data.platform;
        setPlatforms(prevP => prevP.map(p => (p.platformId === saved.platformId ? saved : p)));
        triggerToast('success', 'Platform Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setPlatforms(prevP => prevP.map(p => (p.platformId === platformObj.platformId ? prev : p)));
        triggerToast('error', 'Failed to Update Platform', getErrorMessage(err));
        throw err;
      }
    },
    [platforms, triggerToast],
  );

  const togglePlatformStatus = useCallback(
    async (platformId) => {
      const prev = platforms.find(p => p.platformId === platformId);
      if (!prev) return null;
      const nextStatus = prev.status === 'Active' ? 'Disabled' : 'Active';
      if (prev) setPlatforms(prevP => prevP.map(p => (p.platformId === platformId ? { ...p, status: nextStatus } : p)));

      try {
        const data = await apiFetch(`/api/platforms/${encodeURIComponent(platformId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ statusOnly: true }),
        });
        const platform = data.platform;
        setPlatforms(prevP => prevP.map(p => (p.platformId === platform.platformId ? platform : p)));
        triggerToast('info', 'Platform Policy Modified', `Platform ${platform.platformName} set to ${platform.status}.`);
        return platform;
      } catch (err) {
        if (prev) setPlatforms(prevP => prevP.map(p => (p.platformId === platformId ? prev : p)));
        triggerToast('error', 'Failed to Toggle Platform', getErrorMessage(err));
        throw err;
      }
    },
    [platforms, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchPlatforms();
  }, [fetchPlatforms]);

  const deletePlatform = useCallback(
    async (platformId) => {
      const prev = platforms.find(p => p.platformId === platformId);
      if (!prev) return null;

      setPlatforms(prevP => prevP.filter(p => p.platformId !== platformId));

      try {
        const data = await apiFetch(`/api/platforms/${encodeURIComponent(platformId)}`, {
          method: 'DELETE',
        });
        const removed = data.platform;
        triggerToast('info', 'Platform Removed', `${removed.platformName} (${removed.platformId}) was deleted.`);
        return removed;
      } catch (err) {
        setPlatforms(prevP =>
          prevP.some(p => p.platformId === platformId) ? prevP : [prev, ...prevP],
        );
        triggerToast('error', 'Platform Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [platforms, triggerToast],
  );

  return { platforms, loading, error, addPlatform, updatePlatform, togglePlatformStatus, deletePlatform, refetch };
}

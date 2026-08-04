import { useCallback, useEffect, useState } from 'react';
import { INITIAL_SETTINGS } from '@/data/seedData';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useSettings(triggerToast) {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      const data = await apiFetch('/api/settings');
      setSettings(prev => ({ ...prev, ...data.settings }));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateBaseRate = useCallback(
    async (rate) => {
      try {
        const data = await apiFetch('/api/settings/base-rate', {
          method: 'PUT',
          body: JSON.stringify({ rate }),
        });
        setSettings(data.settings);
        triggerToast('success', 'Base Rate Updated', `Default dollar rate set to ৳${rate}.`);
      } catch (err) {
        triggerToast('error', 'Rate Update Failed', getErrorMessage(err));
      }
    },
    [triggerToast],
  );

  const addPaymentMethod = useCallback(
    async (method) => {
      try {
        const data = await apiFetch('/api/settings/payment-methods', {
          method: 'POST',
          body: JSON.stringify({ name: method }),
        });
        setSettings(data.settings);
        triggerToast('success', 'Payment Method Added', `${method} has been added.`);
      } catch (err) {
        triggerToast('error', 'Failed to Add Payment Method', getErrorMessage(err));
      }
    },
    [triggerToast],
  );

  const deletePaymentMethod = useCallback(
    async (method) => {
      try {
        const data = await apiFetch(`/api/settings/payment-methods/${encodeURIComponent(method)}`, {
          method: 'DELETE',
        });
        setSettings(data.settings);
        triggerToast('info', 'Payment Method Removed', `${method} has been deleted.`);
      } catch (err) {
        triggerToast('error', 'Failed to Delete Payment Method', getErrorMessage(err));
      }
    },
    [triggerToast],
  );

  return { settings, loading, error, updateBaseRate, addPaymentMethod, deletePaymentMethod };
}

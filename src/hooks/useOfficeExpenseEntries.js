import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useOfficeExpenseEntries(triggerToast) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEntries = useCallback(async () => {
    try {
      const data = await apiFetch('/api/office-expense-entries');
      setEntries(data.entries || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const addEntry = useCallback(
    async (entryData) => {
      try {
        const data = await apiFetch('/api/office-expense-entries', {
          method: 'POST',
          body: JSON.stringify(entryData),
        });
        setEntries(prev => [data.entry, ...prev]);
        triggerToast('success', 'Entry Added', `Voucher ${data.entry.voucherNo || ''} recorded.`);
        return data.entry;
      } catch (err) {
        triggerToast('error', 'Failed to Add Entry', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateEntry = useCallback(
    async (objOrId, updates) => {
      const entryObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      const prev = entries.find((e) => e.id === entryObj.id);
      if (prev) setEntries((prevE) => prevE.map((e) => (e.id === entryObj.id ? { ...e, ...entryObj } : e)));

      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryObj.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(entryObj),
        });
        const saved = data.entry;
        setEntries((prevE) => prevE.map((e) => (e.id === saved.id ? saved : e)));
        triggerToast('success', 'Entry Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setEntries((prevE) => prevE.map((e) => (e.id === entryObj.id ? prev : e)));
        triggerToast('error', 'Failed to Update Entry', getErrorMessage(err));
        throw err;
      }
    },
    [entries, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchEntries();
  }, [fetchEntries]);

  const deleteEntry = useCallback(
    async (entryId) => {
      const prev = entries.find((e) => e.id === entryId);
      if (!prev) return null;
      setEntries((prevE) => prevE.filter((e) => e.id !== entryId));

      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryId)}`, {
          method: 'DELETE',
        });
        triggerToast('info', 'Entry Removed', `Voucher ${prev.voucherNo || ''} deleted.`);
        return data.entry;
      } catch (err) {
        setEntries((prevE) => (prevE.some((e) => e.id === entryId) ? prevE : [prev, ...prevE]));
        triggerToast('error', 'Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [entries, triggerToast],
  );

  return { entries, loading, error, addEntry, updateEntry, deleteEntry, refetch };
}

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useOfficeExpenses(triggerToast) {
  const [officeExpenses, setOfficeExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOfficeExpenses = useCallback(async () => {
    try {
      const data = await apiFetch('/api/office-expenses');
      setOfficeExpenses(data.officeExpenses || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchOfficeExpenses();
  }, [fetchOfficeExpenses]);

  const addOfficeExpense = useCallback(
    async (officeExpenseData) => {
      try {
        const data = await apiFetch('/api/office-expenses', {
          method: 'POST',
          body: JSON.stringify(officeExpenseData),
        });
        setOfficeExpenses(prev => [...prev, data.officeExpense]);
        triggerToast('success', 'Category Added', `${data.officeExpense.mainCategory} has been created.`);
        return data.officeExpense;
      } catch (err) {
        triggerToast('error', 'Failed to Add Category', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateOfficeExpense = useCallback(
    async (objOrId, updates) => {
      const officeExpenseObj =
        typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };

      const prev = officeExpenses.find(s => s.id === officeExpenseObj.id);
      if (prev)
        setOfficeExpenses(prevS =>
          prevS.map(s => (s.id === officeExpenseObj.id ? { ...s, ...officeExpenseObj } : s)),
        );

      try {
        const data = await apiFetch(`/api/office-expenses/${encodeURIComponent(officeExpenseObj.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(officeExpenseObj),
        });
        const saved = data.officeExpense;
        setOfficeExpenses(prevS => prevS.map(s => (s.id === saved.id ? saved : s)));
        triggerToast('success', 'Category Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev)
          setOfficeExpenses(prevS => prevS.map(s => (s.id === officeExpenseObj.id ? prev : s)));
        triggerToast('error', 'Failed to Update Category', getErrorMessage(err));
        throw err;
      }
    },
    [officeExpenses, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchOfficeExpenses();
  }, [fetchOfficeExpenses]);

  const deleteOfficeExpense = useCallback(
    async (officeExpenseId) => {
      const prev = officeExpenses.find(s => s.id === officeExpenseId);
      if (!prev) return null;

      setOfficeExpenses(prevS => prevS.filter(s => s.id !== officeExpenseId));

      try {
        const data = await apiFetch(`/api/office-expenses/${encodeURIComponent(officeExpenseId)}`, {
          method: 'DELETE',
        });
        const removed = data.officeExpense;
        triggerToast('info', 'Category Removed', `${removed.mainCategory} was deleted.`);
        return removed;
      } catch (err) {
        setOfficeExpenses(prevS =>
          prevS.some(s => s.id === officeExpenseId) ? prevS : [prev, ...prevS],
        );
        triggerToast('error', 'Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [officeExpenses, triggerToast],
  );

  return {
    officeExpenses,
    loading,
    error,
    addOfficeExpense,
    updateOfficeExpense,
    deleteOfficeExpense,
    refetch,
  };
}

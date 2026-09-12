import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useOfficeExpenseFund(triggerToast) {
  const [fund, setFund] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFund = useCallback(async () => {
    try {
      const data = await apiFetch('/api/office-expense-fund?limit=100');
      setFund(data.fund || null);
      setTransactions(data.transactions || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast?.('error', 'Fund Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchFund();
  }, [fetchFund]);

  const addFunds = useCallback(
    async ({ amount, note, month, actor }) => {
      try {
        const data = await apiFetch('/api/office-expense-fund', {
          method: 'POST',
          body: JSON.stringify({ amount, note, month, actor }),
        });
        setFund(data.fund || null);
        // Refresh the ledger so the new funding appears in history immediately.
        try {
          const refreshed = await apiFetch('/api/office-expense-fund?limit=100');
          setFund(refreshed.fund || null);
          setTransactions(refreshed.transactions || []);
        } catch {
          // Balance already updated above; history refresh is best-effort.
        }
        triggerToast?.(
          'success',
          'Balance Funded',
          `৳${Number(amount).toLocaleString()} added to the office expense balance.`,
        );
        return data.fund;
      } catch (err) {
        triggerToast?.('error', 'Funding Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const refreshAfterMutation = useCallback(async () => {
    try {
      const refreshed = await apiFetch('/api/office-expense-fund?limit=100');
      setFund(refreshed.fund || null);
      setTransactions(refreshed.transactions || []);
    } catch {
      // best-effort; balances already updated by the mutation response
    }
  }, []);

  const updateFunds = useCallback(
    async (id, { amount, note, editNote, actor }) => {
      try {
        const data = await apiFetch(`/api/office-expense-fund/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ amount, note, editNote, actor }),
        });
        if (data.fund) setFund(data.fund);
        await refreshAfterMutation();
        triggerToast?.('success', 'Ad Money Updated', `Entry updated to ৳${Number(amount).toLocaleString()}.`);
        return data;
      } catch (err) {
        triggerToast?.('error', 'Update Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, refreshAfterMutation],
  );

  const deleteFunds = useCallback(
    async (id) => {
      try {
        const data = await apiFetch(`/api/office-expense-fund/${id}`, {
          method: 'DELETE',
        });
        if (data.fund) setFund(data.fund);
        await refreshAfterMutation();
        triggerToast?.('success', 'Ad Money Deleted', 'The entry was removed and the balance adjusted.');
        return data;
      } catch (err) {
        triggerToast?.('error', 'Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, refreshAfterMutation],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchFund();
  }, [fetchFund]);

  return { fund, transactions, loading, error, addFunds, updateFunds, deleteFunds, refetch };
}

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useRefunds(triggerToast) {
  const [refunds, setRefunds] = useState([]);
  const [summary, setSummary] = useState({
    lifetimeRefund: 0,
    thisMonthRefund: 0,
    thisMonthName: '',
    thisMonthLabel: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRefunds = useCallback(async () => {
    try {
      const data = await apiFetch('/api/refunds');
      setRefunds(data.refunds || []);
      if (data.summary) setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const addRefund = useCallback(
    async (refundData) => {
      try {
        const data = await apiFetch('/api/refunds', {
          method: 'POST',
          body: JSON.stringify(refundData),
        });
        setRefunds(prev => [data.refund, ...prev]);
        triggerToast('success', 'Refund Recorded', `৳${Number(data.refund.totalAmountBDT || 0).toLocaleString()} refunded.`);
        return data.refund;
      } catch (err) {
        triggerToast('error', 'Failed to Record Refund', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateRefund = useCallback(
    async (objOrId, updates) => {
      const refundObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      const prev = refunds.find((r) => r.id === refundObj.id);
      if (prev) setRefunds((prevR) => prevR.map((r) => (r.id === refundObj.id ? { ...r, ...refundObj } : r)));

      try {
        const data = await apiFetch(`/api/refunds/${encodeURIComponent(refundObj.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(refundObj),
        });
        const saved = data.refund;
        setRefunds((prevR) => prevR.map((r) => (r.id === saved.id ? saved : r)));
        triggerToast('success', 'Refund Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setRefunds((prevR) => prevR.map((r) => (r.id === refundObj.id ? prev : r)));
        triggerToast('error', 'Failed to Update Refund', getErrorMessage(err));
        throw err;
      }
    },
    [refunds, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchRefunds();
  }, [fetchRefunds]);

  const deleteRefund = useCallback(
    async (refundId) => {
      const prev = refunds.find((r) => r.id === refundId);
      if (!prev) return null;
      setRefunds((prevR) => prevR.filter((r) => r.id !== refundId));

      try {
        const data = await apiFetch(`/api/refunds/${encodeURIComponent(refundId)}`, {
          method: 'DELETE',
        });
        triggerToast('info', 'Refund Removed', 'Record deleted.');
        return data.refund;
      } catch (err) {
        setRefunds((prevR) => (prevR.some((r) => r.id === refundId) ? prevR : [prev, ...prevR]));
        triggerToast('error', 'Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [refunds, triggerToast],
  );

  return { refunds, summary, loading, error, addRefund, updateRefund, deleteRefund, refetch };
}

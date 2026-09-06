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

  const applyApprovalResult = useCallback((saved) => {
    if (!saved) return saved;
    setEntries((prevE) => prevE.map((e) => (e.id === saved.id ? saved : e)));
    return saved;
  }, []);

  const approveEntry = useCallback(
    async (entryId, payload = {}) => {
      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryId)}/approve`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const saved = applyApprovalResult(data.entry);
        triggerToast('success', 'Approval Recorded', `Voucher ${saved?.voucherNo || ''} approved (${saved?.approvals?.length || 0}/${saved?.requiredApprovals || 0}).`);
        return saved;
      } catch (err) {
        triggerToast('error', 'Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, applyApprovalResult],
  );

  const finalApproveEntry = useCallback(
    async (entryId, payload = {}) => {
      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryId)}/final-approve`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const saved = applyApprovalResult(data.entry);
        triggerToast('success', 'Finally Approved', `Voucher ${saved?.voucherNo || ''} approved. Amount deducted from Cash In Hand.`);
        return saved;
      } catch (err) {
        triggerToast('error', 'Final Approval Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, applyApprovalResult],
  );

  const reviewEntry = useCallback(
    async (entryId, note, payload = {}) => {
      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryId)}/review`, {
          method: 'PATCH',
          body: JSON.stringify({ note, ...payload }),
        });
        const saved = applyApprovalResult(data.entry);
        triggerToast('warning', 'Review Requested', `Voucher ${saved?.voucherNo || ''} marked as Review Need.`);
        return saved;
      } catch (err) {
        triggerToast('error', 'Review Request Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, applyApprovalResult],
  );

  const rejectEntry = useCallback(
    async (entryId, note, payload = {}) => {
      try {
        const data = await apiFetch(`/api/office-expense-entries/${encodeURIComponent(entryId)}/reject`, {
          method: 'PATCH',
          body: JSON.stringify({ note, ...payload }),
        });
        const saved = applyApprovalResult(data.entry);
        triggerToast('error', 'Entry Rejected', `Voucher ${saved?.voucherNo || ''} rejected.`);
        return saved;
      } catch (err) {
        triggerToast('error', 'Rejection Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast, applyApprovalResult],
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

  return { entries, loading, error, addEntry, updateEntry, deleteEntry, approveEntry, finalApproveEntry, reviewEntry, rejectEntry, refetch };
}

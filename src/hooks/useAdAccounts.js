import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useAdAccounts(triggerToast) {
  const [adAccounts, setAdAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAdAccounts = useCallback(async () => {
    try {
      const data = await apiFetch('/api/ad-accounts');
      setAdAccounts(data.adAccounts || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdAccounts();
  }, [fetchAdAccounts]);

  const addAdAccount = useCallback(
    async (accountData) => {
      try {
        const data = await apiFetch('/api/ad-accounts', {
          method: 'POST',
          body: JSON.stringify(accountData),
        });
        const newAccount = data.adAccount;
        setAdAccounts(prev => [newAccount, ...prev]);
        triggerToast(
          'success',
          'Ad Account Loaded',
          `${newAccount.adAccountName} is now ready for deployment.`,
        );
        return newAccount;
      } catch (err) {
        triggerToast('error', 'Ad Account Load Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateAdAccount = useCallback(
    async (updatedAcc) => {
      const id = updatedAcc._id || updatedAcc.adAccountId;
      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(updatedAcc),
        });
        const saved = data.adAccount;
        setAdAccounts(prev =>
          prev.map(a => (a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a)),
        );
        triggerToast(
          'success',
          'Ad Account Updated',
          `Updated settings for ${saved.adAccountName}`,
        );
        return saved;
      } catch (err) {
        triggerToast('error', 'Ad Account Update Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const deleteAdAccount = useCallback(
    async (accountId) => {
      const prev = adAccounts.find(a => a._id === accountId || a.adAccountId === accountId);
      if (!prev) return null;

      // Optimistic removal — item vanishes instantly, restored on failure.
      setAdAccounts(prevList => prevList.filter(a => a._id !== accountId && a.adAccountId !== accountId));

      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(accountId)}`, {
          method: 'DELETE',
        });
        triggerToast('info', 'Ad Account Removed', `${prev.adAccountName} was deleted from inventory.`);
        return data.adAccount;
      } catch (err) {
        setAdAccounts(prevList =>
          prevList.some(a => a._id === accountId || a.adAccountId === accountId) ? prevList : [prev, ...prevList],
        );
        triggerToast('error', 'Ad Account Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [adAccounts, triggerToast],
  );

  const updateAccountStatus = useCallback(
    async (accountId, status) => {
      const match = (a) => a._id === accountId || a.adAccountId === accountId;
      const prevSnapshot = adAccounts.filter(match).map(a => ({ id: a._id || a.adAccountId, accountStatus: a.accountStatus }));

      // Optimistic update — reflect the new status immediately, roll back on failure
      setAdAccounts(prev => prev.map(a => (match(a) ? { ...a, accountStatus: status } : a)));

      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(accountId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status, statusOnly: true }),
        });
        const saved = data.adAccount;
        setAdAccounts(prev =>
          prev.map(a =>
            a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a,
          ),
        );
        triggerToast(
          'success',
          'Account Status Sync',
          `Account ID ...${String(accountId).slice(-6)} set to ${status}.`,
        );
        return saved;
      } catch (err) {
        setAdAccounts(prev =>
          prev.map(a =>
            match(a) ? { ...a, accountStatus: prevSnapshot.find(p => p.id === (a._id || a.adAccountId))?.accountStatus || a.accountStatus } : a,
          ),
        );
        triggerToast('error', 'Status Update Failed', getErrorMessage(err));
        throw err;
      }
    },
    [adAccounts, triggerToast],
  );

  const bulkUpdateStatus = useCallback(
    async (accountIds, status) => {
      const idSet = new Set(accountIds);
      const prevSnapshot = new Map(
        adAccounts.filter(a => idSet.has(a._id) || idSet.has(a.adAccountId)).map(a => [a._id || a.adAccountId, a.accountStatus]),
      );

      // Optimistic update for all affected accounts
      setAdAccounts(prev =>
        prev.map(a =>
          idSet.has(a._id) || idSet.has(a.adAccountId)
            ? { ...a, accountStatus: status, status: status }
            : a,
        ),
      );

      try {
        const data = await apiFetch('/api/ad-accounts/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({ ids: accountIds, status }),
        });
        setAdAccounts(prev =>
          prev.map(a =>
            idSet.has(a._id) || idSet.has(a.adAccountId)
              ? { ...a, accountStatus: status, status: status }
              : a,
          ),
        );
        triggerToast(
          'success',
          'Bulk Action Complete',
          `Successfully set ${accountIds.length} accounts to ${status}.`,
        );
        return data;
      } catch (err) {
        setAdAccounts(prev =>
          prev.map(a =>
            idSet.has(a._id) || idSet.has(a.adAccountId)
              ? { ...a, accountStatus: prevSnapshot.get(a._id || a.adAccountId) || a.accountStatus, status: prevSnapshot.get(a._id || a.adAccountId) || a.status }
              : a,
          ),
        );
        triggerToast('error', 'Bulk Action Failed', getErrorMessage(err));
        throw err;
      }
    },
    [adAccounts, triggerToast],
  );

  const markAccountSold = useCallback(
    (adAccountId, customerId) => {
      setAdAccounts(prev =>
        prev.map(acc =>
          acc.adAccountId === adAccountId
            ? { ...acc, accountStatus: 'Sold', assignedCustomer: customerId }
            : acc,
        ),
      );
    },
    [],
  );

  const assignAdAccount = useCallback(
    async (adAccountId, customerId) => {
      const prev = adAccounts.find(a => a.adAccountId === adAccountId);

      // Optimistic assignment — mark Sold instantly, rolled back on failure.
      if (prev) {
        setAdAccounts(prevList =>
          prevList.map(a =>
            a.adAccountId === adAccountId ? { ...a, accountStatus: 'Sold', assignedCustomer: customerId } : a,
          ),
        );
      }

      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(adAccountId)}/assign`, {
          method: 'POST',
          body: JSON.stringify({ customerId }),
        });
        const saved = data.adAccount;
        setAdAccounts(prevList =>
          prevList.map(a => (a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a)),
        );
        triggerToast(
          'success',
          'Ad Account Assigned',
          `${saved.adAccountName} assigned to customer ${saved.assignedCustomer}.`,
        );
        return saved;
      } catch (err) {
        if (prev) {
          setAdAccounts(prevList =>
            prevList.map(a => (a.adAccountId === adAccountId ? prev : a)),
          );
        }
        triggerToast('error', 'Assignment Failed', getErrorMessage(err));
        throw err;
      }
    },
    [adAccounts, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchAdAccounts();
  }, [fetchAdAccounts]);

  return {
    adAccounts,
    loading,
    error,
    addAdAccount,
    updateAdAccount,
    deleteAdAccount,
    updateAccountStatus,
    bulkUpdateStatus,
    markAccountSold,
    assignAdAccount,
    refetch,
  };
}
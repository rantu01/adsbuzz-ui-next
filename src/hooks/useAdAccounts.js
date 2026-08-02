import { useCallback, useEffect, useState } from 'react';

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
        triggerToast('error', 'Ad Account Load Failed', err.message);
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
        triggerToast('error', 'Ad Account Update Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const updateAccountStatus = useCallback(
    async (accountId, status) => {
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
        triggerToast('error', 'Status Update Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const bulkUpdateStatus = useCallback(
    async (accountIds, status) => {
      try {
        const data = await apiFetch('/api/ad-accounts/bulk-status', {
          method: 'PATCH',
          body: JSON.stringify({ ids: accountIds, status }),
        });
        const idSet = new Set(accountIds);
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
        triggerToast('error', 'Bulk Action Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
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
    updateAccountStatus,
    bulkUpdateStatus,
    markAccountSold,
    refetch,
  };
}
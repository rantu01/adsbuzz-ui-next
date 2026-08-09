import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useSocialAdAccounts(triggerToast) {
  const [socialAdAccounts, setSocialAdAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSocialAdAccounts = useCallback(async () => {
    try {
      const data = await apiFetch('/api/social-ad-accounts');
      setSocialAdAccounts(data.adAccounts || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSocialAdAccounts();
  }, [fetchSocialAdAccounts]);

  const addSocialAdAccount = useCallback(
    async (accountData) => {
      try {
        const data = await apiFetch('/api/social-ad-accounts', {
          method: 'POST',
          body: JSON.stringify(accountData),
        });
        const newAccount = data.adAccount;
        setSocialAdAccounts(prev => [newAccount, ...prev]);
        triggerToast(
          'success',
          'Social Ad Account Loaded',
          `${newAccount.adAccountName} has been cataloged in the Load Social Ad Account collection.`,
        );
        return newAccount;
      } catch (err) {
        triggerToast('error', 'Social Ad Account Load Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateSocialAdAccount = useCallback(
    async (updatedAcc) => {
      const id = updatedAcc._id || updatedAcc.adAccountId;
      try {
        const data = await apiFetch(`/api/social-ad-accounts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(updatedAcc),
        });
        const saved = data.adAccount;
        setSocialAdAccounts(prev =>
          prev.map(a => (a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a)),
        );
        triggerToast(
          'success',
          'Social Ad Account Updated',
          `Updated settings for ${saved.adAccountName}`,
        );
        return saved;
      } catch (err) {
        triggerToast('error', 'Social Ad Account Update Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const deleteSocialAdAccount = useCallback(
    async (accountId) => {
      const prev = socialAdAccounts.find(a => a._id === accountId || a.adAccountId === accountId);
      if (!prev) return null;

      // Optimistic removal — item vanishes instantly, restored on failure.
      setSocialAdAccounts(prevList => prevList.filter(a => a._id !== accountId && a.adAccountId !== accountId));

      try {
        const data = await apiFetch(`/api/social-ad-accounts/${encodeURIComponent(accountId)}`, {
          method: 'DELETE',
        });
        triggerToast('info', 'Social Ad Account Removed', `${prev.adAccountName} was deleted.`);
        return data.adAccount;
      } catch (err) {
        setSocialAdAccounts(prevList =>
          prevList.some(a => a._id === accountId || a.adAccountId === accountId) ? prevList : [prev, ...prevList],
        );
        triggerToast('error', 'Social Ad Account Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [socialAdAccounts, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchSocialAdAccounts();
  }, [fetchSocialAdAccounts]);

  return {
    socialAdAccounts,
    loading,
    error,
    addSocialAdAccount,
    updateSocialAdAccount,
    deleteSocialAdAccount,
    refetch,
  };
}

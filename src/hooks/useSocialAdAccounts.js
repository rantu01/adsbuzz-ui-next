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

  // Assignment uses the shared /api/ad-accounts/:id/assign + unassign endpoints
  // (which resolve both regular and social ad accounts), so the same "assign &
  // mark Sold" semantics apply across the Customers and Ad Account Inventory pages.
  const assignSocialAdAccount = useCallback(
    async (adAccountId, customerId) => {
      const prev = socialAdAccounts.find(a => a.adAccountId === adAccountId || a._id === adAccountId);
      if (prev) {
        setSocialAdAccounts(prevList =>
          prevList.map(a =>
            a.adAccountId === adAccountId || a._id === adAccountId
              ? { ...a, accountStatus: 'Sold', assignedCustomer: customerId }
              : a,
          ),
        );
      }
      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(adAccountId)}/assign`, {
          method: 'POST',
          body: JSON.stringify({ customerId }),
        });
        const saved = data.adAccount;
        setSocialAdAccounts(prevList =>
          prevList.map(a =>
            a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a,
          ),
        );
        triggerToast('success', 'Ad Account Assigned', `${saved.adAccountName} assigned to customer ${saved.assignedCustomer}.`);
        return saved;
      } catch (err) {
        if (prev) {
          setSocialAdAccounts(prevList =>
            prevList.map(a => (a.adAccountId === adAccountId || a._id === adAccountId ? prev : a)),
          );
        }
        triggerToast('error', 'Assignment Failed', getErrorMessage(err));
        throw err;
      }
    },
    [socialAdAccounts, triggerToast],
  );

  const unassignSocialAdAccount = useCallback(
    async (adAccountId, reason) => {
      const prev = socialAdAccounts.find(a => a._id === adAccountId || a.adAccountId === adAccountId);
      if (prev) {
        setSocialAdAccounts(prevList =>
          prevList.map(a =>
            a._id === adAccountId || a.adAccountId === adAccountId
              ? { ...a, accountStatus: 'Available', assignedCustomer: '' }
              : a,
          ),
        );
      }
      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(adAccountId)}/unassign`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason || '' }),
        });
        const saved = {
          ...data.adAccount,
          previousCustomerId: data.previousCustomerId || prev?.assignedCustomer || '',
        };
        setSocialAdAccounts(prevList => prevList.map(a => (a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a)));
        triggerToast('success', 'Ad Account Unassigned', `${saved.adAccountName} returned to the available pool.`);
        return saved;
      } catch (err) {
        if (prev) {
          setSocialAdAccounts(prevList =>
            prevList.map(a => (a._id === adAccountId || a.adAccountId === adAccountId ? prev : a)),
          );
        }
        triggerToast('error', 'Unassign Failed', getErrorMessage(err));
        throw err;
      }
    },
    [socialAdAccounts, triggerToast],
  );

  const updateAccountStatus = useCallback(
    async (accountId, status) => {
      const match = (a) => a._id === accountId || a.adAccountId === accountId;
      const prevSnapshot = socialAdAccounts
        .filter(match)
        .map((a) => ({ id: a._id || a.adAccountId, accountStatus: a.accountStatus }));

      // Optimistic update — reflect the new status immediately, roll back on failure.
      setSocialAdAccounts((prev) => prev.map((a) => (match(a) ? { ...a, accountStatus: status } : a)));

      try {
        const data = await apiFetch(`/api/ad-accounts/${encodeURIComponent(accountId)}`, {
          method: "PATCH",
          body: JSON.stringify({ status, statusOnly: true }),
        });
        const saved = data.adAccount;
        setSocialAdAccounts((prev) =>
          prev.map((a) => (a._id === saved._id || a.adAccountId === saved.adAccountId ? saved : a)),
        );
        triggerToast("success", "Account Status Sync", `Account ID ...${String(accountId).slice(-6)} set to ${status}.`);
        return saved;
      } catch (err) {
        setSocialAdAccounts((prev) =>
          prev.map((a) =>
            match(a)
              ? { ...a, accountStatus: prevSnapshot.find((p) => p.id === (a._id || a.adAccountId))?.accountStatus || a.accountStatus }
              : a,
          ),
        );
        triggerToast("error", "Status Update Failed", getErrorMessage(err));
        throw err;
      }
    },
    [socialAdAccounts, triggerToast],
  );

  const bulkUpdateStatus = useCallback(
    async (accountIds, status) => {
      const idSet = new Set(accountIds);
      const prevSnapshot = new Map(
        socialAdAccounts
          .filter((a) => idSet.has(a._id) || idSet.has(a.adAccountId))
          .map((a) => [a._id || a.adAccountId, a.accountStatus]),
      );

      // Optimistic update for all affected accounts.
      setSocialAdAccounts((prev) =>
        prev.map((a) =>
          idSet.has(a._id) || idSet.has(a.adAccountId) ? { ...a, accountStatus: status } : a,
        ),
      );

      try {
        const data = await apiFetch("/api/social-ad-accounts/bulk-status", {
          method: "PATCH",
          body: JSON.stringify({ ids: accountIds, status }),
        });
        setSocialAdAccounts((prev) =>
          prev.map((a) =>
            idSet.has(a._id) || idSet.has(a.adAccountId) ? { ...a, accountStatus: status } : a,
          ),
        );
        triggerToast("success", "Bulk Action Complete", `Successfully set ${accountIds.length} accounts to ${status}.`);
        return data;
      } catch (err) {
        setSocialAdAccounts((prev) =>
          prev.map((a) =>
            idSet.has(a._id) || idSet.has(a.adAccountId)
              ? { ...a, accountStatus: prevSnapshot.get(a._id || a.adAccountId) || a.accountStatus }
              : a,
          ),
        );
        triggerToast("error", "Bulk Action Failed", getErrorMessage(err));
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
    assignSocialAdAccount,
    unassignSocialAdAccount,
    updateAccountStatus,
    bulkUpdateStatus,
    refetch,
  };
}

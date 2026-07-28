import { useCallback, useState } from 'react';
import { INITIAL_AD_ACCOUNTS } from '@/data/seedData';

export function useAdAccounts(triggerToast) {
  const [adAccounts, setAdAccounts] = useState(INITIAL_AD_ACCOUNTS);

  const addAdAccount = useCallback(
    (accountData) => {
      setAdAccounts(prev => [accountData, ...prev]);
      triggerToast(
        'success',
        'Ad Account Loaded',
        `${accountData.adAccountName} is now ready for deployment.`,
      );
    },
    [triggerToast],
  );

  const updateAdAccount = useCallback(
    (updatedAcc) => {
      setAdAccounts(prev =>
        prev.map(a => (a.adAccountId === updatedAcc.adAccountId ? updatedAcc : a)),
      );
      triggerToast(
        'success',
        'Ad Account Updated',
        `Updated settings for ${updatedAcc.adAccountName}`,
      );
    },
    [triggerToast],
  );

  const updateAccountStatus = useCallback(
    (accountId, status) => {
      setAdAccounts(prev =>
        prev.map(acc => (acc.adAccountId === accountId ? { ...acc, accountStatus: status } : acc)),
      );
      triggerToast(
        'success',
        'Account Status Sync',
        `Account ID ...${accountId.slice(-6)} set to ${status}.`,
      );
    },
    [triggerToast],
  );

  const bulkUpdateStatus = useCallback(
    (accountIds, status) => {
      const idSet = new Set(accountIds);
      setAdAccounts(prev =>
        prev.map(acc => (idSet.has(acc.adAccountId) ? { ...acc, accountStatus: status } : acc)),
      );
      triggerToast(
        'success',
        'Bulk Action Complete',
        `Successfully set ${accountIds.length} accounts to ${status}.`,
      );
    },
    [triggerToast],
  );

  const markAccountSold = useCallback((adAccountId, customerId) => {
    setAdAccounts(prev =>
      prev.map(acc =>
        acc.adAccountId === adAccountId
          ? { ...acc, accountStatus: 'Sold', assignedCustomer: customerId }
          : acc,
      ),
    );
  }, []);

  return {
    adAccounts,
    addAdAccount,
    updateAdAccount,
    updateAccountStatus,
    bulkUpdateStatus,
    markAccountSold,
  };
}
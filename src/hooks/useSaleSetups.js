import { useCallback, useState } from 'react';
import { INITIAL_SETUPS } from '@/data/seedData';

export function useSaleSetups(triggerToast) {
  const [setups, setSetups] = useState(INITIAL_SETUPS);

  const addSetup = useCallback(
    (setupData) => {
      setSetups(prev => [...prev, setupData]);
      triggerToast('success', 'Sale Setup Created', 'New campaign setup saved.');
    },
    [triggerToast],
  );

  const updateSaleSetup = useCallback(
    (groupId, adAccountId, updates) => {
      setSetups(prev => prev.map(s =>
        s.groupId === groupId && s.adAccountId === adAccountId
          ? { ...s, ...updates }
          : s
      ));
      triggerToast('success', 'Sale Setup Updated', 'Changes saved.');
    },
    [triggerToast],
  );

  return { setups, addSetup, updateSaleSetup };
}
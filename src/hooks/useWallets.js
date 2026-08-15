import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useWallets(triggerToast) {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWallets = useCallback(async () => {
    try {
      const data = await apiFetch('/api/wallets');
      setWallets(data.wallets || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchWallets();
  }, [fetchWallets]);

  const addWallet = useCallback(
    async (walletData) => {
      try {
        const data = await apiFetch('/api/wallets', {
          method: 'POST',
          body: JSON.stringify(walletData),
        });
        setWallets(prev => [...prev, data.wallet]);
        triggerToast('success', 'Wallet Added', `${data.wallet.ownerName} has been created.`);
        return data.wallet;
      } catch (err) {
        triggerToast('error', 'Failed to Add Wallet', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateWallet = useCallback(
    async (objOrId, updates) => {
      const walletObj = typeof objOrId === 'object' ? objOrId : { walletId: objOrId, ...updates };

      const prev = wallets.find(w => w.walletId === walletObj.walletId);
      if (prev) setWallets(prevW => prevW.map(w => (w.walletId === walletObj.walletId ? { ...w, ...walletObj } : w)));

      try {
        const data = await apiFetch(`/api/wallets/${encodeURIComponent(walletObj.walletId)}`, {
          method: 'PATCH',
          body: JSON.stringify(walletObj),
        });
        const saved = data.wallet;
        setWallets(prevW => prevW.map(w => (w.walletId === saved.walletId ? saved : w)));
        triggerToast('success', 'Wallet Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setWallets(prevW => prevW.map(w => (w.walletId === walletObj.walletId ? prev : w)));
        triggerToast('error', 'Failed to Update Wallet', getErrorMessage(err));
        throw err;
      }
    },
    [wallets, triggerToast],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchWallets();
  }, [fetchWallets]);

  const deleteWallet = useCallback(
    async (walletId) => {
      const prev = wallets.find(w => w.walletId === walletId);
      if (!prev) return null;

      setWallets(prevW => prevW.filter(w => w.walletId !== walletId));

      try {
        const data = await apiFetch(`/api/wallets/${encodeURIComponent(walletId)}`, {
          method: 'DELETE',
        });
        const removed = data.wallet;
        triggerToast('info', 'Wallet Removed', `${removed.ownerName} (${removed.walletId}) was deleted.`);
        return removed;
      } catch (err) {
        setWallets(prevW =>
          prevW.some(w => w.walletId === walletId) ? prevW : [prev, ...prevW],
        );
        triggerToast('error', 'Wallet Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [wallets, triggerToast],
  );

  return { wallets, loading, error, addWallet, updateWallet, deleteWallet, refetch };
}

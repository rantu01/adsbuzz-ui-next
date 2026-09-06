import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

/**
 * Server-side "Top Client Current Month" for the Customers page summary card.
 * Fetches ONE tiny payload from GET /api/customers/top-client-current-month
 * (Client Name, Group ID, Total Topup Amount) instead of downloading the full
 * ledger for client-side math. While `loading` is true (or `data` is null)
 * callers must render a loading skeleton — never a default 0 / "No top-up
 * data" — then swap in actual values.
 */
export function useTopClientCurrentMonth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setData(null);
    setLoading(true);
    setError(null);

    apiFetch('/api/customers/top-client-current-month', {
      signal: controller.signal,
    })
      .then((payload) => {
        if (cancelled) return;
        setData(payload || null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AbortError') return;
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return {
    topClient: data?.topClient || null,
    totalTopupUSD: Number(data?.totalTopupUSD || 0),
    month: data?.month || '',
    data,
    loading,
    error,
  };
}

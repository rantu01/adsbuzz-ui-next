import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

/**
 * Server-side Monthly Topup Insights for ONE selected customer.
 * Fetches ONLY that customer's scoped insights from
 * GET /api/customers/[id]/monthly-insights (no full-ledger download).
 * While `loading` is true (or `insights` is null) callers must render a
 * loading skeleton — never a default 0% — then swap in actual values.
 */
export function useCustomerMonthlyInsights(customerId) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customerId) {
      setInsights(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    // Clear stale customer's data immediately so the UI never flashes the
    // previous customer's figures while the new customer's data is in flight.
    setInsights(null);
    setLoading(true);
    setError(null);

    apiFetch(`/api/customers/${encodeURIComponent(customerId)}/monthly-insights`, {
      signal: controller.signal,
    })
      .then((payload) => {
        if (cancelled) return;
        setInsights(payload?.insights || null);
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
  }, [customerId]);

  return { insights, loading, error };
}

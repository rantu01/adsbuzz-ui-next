import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

/**
 * On-demand, server-side paginated invoice fetching for the Invoices table and
 * the Sales Entry Records table. Unlike the legacy `useInvoices` (which pulled
 * the whole collection into the browser), this hook only ever requests the
 * single page it needs. Navigating to another page triggers a fresh, bounded
 * MongoDB query for just that slice — no client-side slicing of a giant array.
 *
 * `load`, `setPage`, `setFilters` and `refetch` are intentionally stable (they
 * read the latest page/filters from refs) so callers can safely put them in
 * effect dependencies without creating a refetch loop that resets the page.
 */
export function useInvoicePages({ initialLimit = 10, initialFilters = {} } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPageState] = useState(1);
  const [limit] = useState(initialLimit);
  const [filters, setFiltersState] = useState(initialFilters);
  const [aggregates, setAggregates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Guards against a slow/late response overwriting a newer request's data
  // (e.g. rapidly clicking through pages or changing filters mid-fetch).
  const requestId = useRef(0);

  // Latest values, read inside the stable `load` without forcing it to depend
  // on `filters`/`page`/`totalPages` (which would churn its identity and create
  // a refetch loop in callers that list it in effect deps).
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const pageRef = useRef(page);
  pageRef.current = page;
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  const load = useCallback(
    async (nextPage, nextFilters) => {
      const currentPage = nextPage == null ? pageRef.current : nextPage;
      const currentFilters = nextFilters || filtersRef.current;
      const id = ++requestId.current;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(limit),
        });
        if (currentFilters.search) params.set('search', currentFilters.search);
        if (currentFilters.paymentStatus && currentFilters.paymentStatus !== 'All') {
          params.set('paymentStatus', currentFilters.paymentStatus);
        }
        if (currentFilters.customerId) params.set('customerId', currentFilters.customerId);
        if (currentFilters.adAccountId) params.set('adAccountId', currentFilters.adAccountId);
        if (currentFilters.date) params.set('date', currentFilters.date);
        if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
        if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);
        if (currentFilters.month) params.set('month', currentFilters.month);

        const data = await apiFetch(`/api/invoices?${params.toString()}`);
        if (id !== requestId.current) return; // stale response

        setRows(Array.isArray(data.invoices) ? data.invoices : []);
        setTotal(Number(data.total) || 0);
        setTotalPages(Number(data.totalPages) || 1);
        setAggregates(data.aggregates || null);
        setPageState(currentPage);
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [limit],
  );

  // Initial load.
  useEffect(() => {
    load(1);
  }, []);

  const setPage = useCallback(
    (p) => {
      const clamped = Math.max(1, Math.min(p, totalPagesRef.current));
      if (clamped === pageRef.current) return;
      load(clamped);
    },
    [load],
  );

  const setFilters = useCallback(
    (nextFilters) => {
      setFiltersState(nextFilters);
      load(1, nextFilters);
    },
    [load],
  );

  const refetch = useCallback(() => {
    load(pageRef.current, filtersRef.current);
  }, [load]);

  return {
    rows,
    total,
    totalPages,
    page,
    limit,
    aggregates,
    loading,
    error,
    setPage,
    setFilters,
    refetch,
  };
}

export { getErrorMessage };

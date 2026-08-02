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

export function useCustomers(triggerToast) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await apiFetch('/api/customers');
      setCustomers(data.customers || []);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const addCustomer = useCallback(
    async (customerData) => {
      try {
        const data = await apiFetch('/api/customers', {
          method: 'POST',
          body: JSON.stringify(customerData),
        });
        const newCustomer = data.customer;
        setCustomers(prev => [newCustomer, ...prev]);
        triggerToast('success', 'Customer Onboarded', `${newCustomer.name} added with ID ${newCustomer.id}`);
        return newCustomer;
      } catch (err) {
        triggerToast('error', 'Customer Onboarding Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const updateCustomer = useCallback(
    async (updatedCust) => {
      try {
        const data = await apiFetch(`/api/customers/${encodeURIComponent(updatedCust.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(updatedCust),
        });
        const saved = data.customer;
        setCustomers(prev => prev.map(c => (c.id === saved.id ? saved : c)));
        triggerToast('success', 'Customer Updated', `Profile updated for ${saved.name}`);
        return saved;
      } catch (err) {
        triggerToast('error', 'Customer Update Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const updateCustomerNotes = useCallback(
    async (customerId, notes) => {
      try {
        const data = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}/notes`, {
          method: 'PATCH',
          body: JSON.stringify({ notes }),
        });
        const saved = data.customer;
        setCustomers(prev => prev.map(c => (c.id === saved.id ? saved : c)));
        triggerToast('success', 'CRM Notes Updated', 'Customer relationship records synchronized.');
        return saved;
      } catch (err) {
        triggerToast('error', 'Notes Update Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const toggleFavorite = useCallback(
    async (customerId) => {
      try {
        const data = await apiFetch(`/api/customers/${encodeURIComponent(customerId)}/favorite`, {
          method: 'PATCH',
        });
        const saved = data.customer;
        const wasFavorite = customers.find(c => c.id === customerId)?.favorite;
        const nextState = !Boolean(wasFavorite);
        setCustomers(prev => prev.map(c => (c.id === saved.id ? saved : c)));
        triggerToast(
          'info',
          nextState ? 'Added to Favorites' : 'Removed from Favorites',
          `${saved.name} bookmarks toggled.`,
        );
        return saved;
      } catch (err) {
        triggerToast('error', 'Favorite Update Failed', err.message);
        throw err;
      }
    },
    [customers, triggerToast],
  );

  const applySaleCredit = useCallback(
    (customerId, paidAmountBDT, topupAmountUSD) => {
      setCustomers(prev =>
        prev.map(c =>
          c.id === customerId
            ? { ...c, balanceBDT: c.balanceBDT + paidAmountBDT, balanceUSD: c.balanceUSD + topupAmountUSD }
            : c,
        ),
      );
    },
    [],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchCustomers();
  }, [fetchCustomers]);

  return {
    customers,
    loading,
    error,
    addCustomer,
    updateCustomer,
    updateCustomerNotes,
    toggleFavorite,
    applySaleCredit,
    refetch,
  };
}

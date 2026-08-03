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

export function useVendors(triggerToast) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVendors = useCallback(async () => {
    try {
      const data = await apiFetch('/api/vendors');
      setVendors(data.vendors || []);
    } catch (err) {
      triggerToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const addVendor = useCallback(
    async (vendorData) => {
      try {
        const data = await apiFetch('/api/vendors', {
          method: 'POST',
          body: JSON.stringify(vendorData),
        });
        setVendors(prev => [...prev, data.vendor]);
        triggerToast('success', 'Vendor Added', `${data.vendor.name} has been added.`);
        return data.vendor;
      } catch (err) {
        triggerToast('error', 'Failed to Add Vendor', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const updateVendor = useCallback(
    async (objOrId, updates) => {
      const vendorObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorObj.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(vendorObj),
        });
        setVendors(prev => prev.map(v => (v.id === data.vendor.id ? data.vendor : v)));
        triggerToast('success', 'Vendor Updated', 'Changes saved.');
        return data.vendor;
      } catch (err) {
        triggerToast('error', 'Failed to Update Vendor', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  const payVendor = useCallback(
    async (vendorId, { amountUSD, paymentMethod, date, transactionId } = {}) => {
      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorId)}/pay`, {
          method: 'POST',
          body: JSON.stringify({ amountUSD, paymentMethod, date, transactionId }),
        });
        setVendors(prev => prev.map(v => (v.id === data.vendor.id ? data.vendor : v)));
        triggerToast('success', 'Payment Recorded', `$${amountUSD} settled to vendor.`);
        return data.vendor;
      } catch (err) {
        triggerToast('error', 'Payment Recording Failed', err.message);
        throw err;
      }
    },
    [triggerToast],
  );

  return { vendors, loading, addVendor, updateVendor, payVendor };
}

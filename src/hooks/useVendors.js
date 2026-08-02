import { useCallback, useEffect, useState } from 'react';

export function useVendors(triggerToast) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await fetch('/api/vendors');
      if (!res.ok) throw new Error('Failed to load vendors');
      const data = await res.json();
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
    (vendorData) => {
      fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorData),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to add vendor');
          }
          return res.json();
        })
        .then((data) => {
          setVendors(prev => [...prev, data.vendor]);
          triggerToast('success', 'Vendor Added', `${data.vendor.name} has been added.`);
        })
        .catch((err) => triggerToast('error', 'Failed to Add Vendor', err.message));
    },
    [triggerToast],
  );

  const updateVendor = useCallback(
    (objOrId, updates) => {
      const vendorObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      fetch(`/api/vendors/${vendorObj.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorObj),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to update vendor');
          }
          return res.json();
        })
        .then((data) => {
          setVendors(prev => prev.map(v => (v.id === data.vendor.id ? data.vendor : v)));
          triggerToast('success', 'Vendor Updated', 'Changes saved.');
        })
        .catch((err) => triggerToast('error', 'Failed to Update Vendor', err.message));
    },
    [triggerToast],
  );

  return { vendors, loading, addVendor, updateVendor };
}
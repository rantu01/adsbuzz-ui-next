import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useVendors(triggerToast) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVendors = useCallback(async () => {
    try {
      const data = await apiFetch('/api/vendors');
      setVendors(data.vendors || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
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
        triggerToast('error', 'Failed to Add Vendor', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateVendor = useCallback(
    async (objOrId, updates) => {
      const vendorObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };

      // Optimistic update, roll back on failure
      const prev = vendors.find(v => v.id === vendorObj.id);
      if (prev) setVendors(prevV => prevV.map(v => (v.id === vendorObj.id ? { ...v, ...vendorObj } : v)));

      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorObj.id)}`, {
          method: 'PATCH',
          body: JSON.stringify(vendorObj),
        });
        const saved = data.vendor;
        setVendors(prevV => prevV.map(v => (v.id === saved.id ? saved : v)));
        triggerToast('success', 'Vendor Updated', 'Changes saved.');
        return saved;
      } catch (err) {
        if (prev) setVendors(prevV => prevV.map(v => (v.id === vendorObj.id ? prev : v)));
        triggerToast('error', 'Failed to Update Vendor', getErrorMessage(err));
        throw err;
      }
    },
    [vendors, triggerToast],
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
        triggerToast('error', 'Payment Recording Failed', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

   const refetch = useCallback(() => {
    setLoading(true);
    return fetchVendors();
  }, [fetchVendors]);

  const deleteVendor = useCallback(
    async (vendorId) => {
      const prev = vendors.find(v => v.id === vendorId);
      if (!prev) return null;

      setVendors(prevList => prevList.filter(v => v.id !== vendorId));

      try {
        const data = await apiFetch(`/api/vendors/${encodeURIComponent(vendorId)}`, {
          method: 'DELETE',
        });
        const removed = data.vendor;
        triggerToast('info', 'Vendor Removed', `${removed.name} (${removed.id}) was deleted.`);
        return removed;
      } catch (err) {
        setVendors(prevList =>
          prevList.some(v => v.id === vendorId) ? prevList : [prev, ...prevList],
        );
        triggerToast('error', 'Vendor Delete Failed', getErrorMessage(err));
        throw err;
      }
    },
    [vendors, triggerToast],
  );

  return { vendors, loading, error, addVendor, updateVendor, payVendor, deleteVendor, refetch };
}
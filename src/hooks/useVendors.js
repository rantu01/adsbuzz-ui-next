import { useCallback, useState } from 'react';
import { INITIAL_VENDORS } from '@/data/seedData';

export function useVendors(triggerToast) {
  const [vendors, setVendors] = useState(INITIAL_VENDORS);

  const addVendor = useCallback(
    (vendorData) => {
      const newId = `VEND-${Date.now()}`;
      setVendors(prev => [...prev, { ...vendorData, id: newId, paymentHistory: [] }]);
      triggerToast('success', 'Vendor Added', `${vendorData.name} has been added.`);
    },
    [triggerToast],
  );

  const updateVendor = useCallback(
    (id, updates) => {
      setVendors(prev => prev.map(v => v.id === id ? { ...v, ...updates } : v));
      triggerToast('success', 'Vendor Updated', 'Changes saved.');
    },
    [triggerToast],
  );

  return { vendors, addVendor, updateVendor };
}
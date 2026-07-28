import { useCallback, useState } from 'react';
import { INITIAL_SETTINGS } from '@/data/seedData';

export function useSettings(triggerToast) {
  const [settings, setSettings] = useState(INITIAL_SETTINGS);

  const updateBaseRate = useCallback(
    (rate) => {
      setSettings(prev => ({ ...prev, defaultDollarRate: rate }));
      triggerToast('success', 'Base Rate Updated', `Default dollar rate set to ৳${rate}.`);
    },
    [triggerToast],
  );

  const addPaymentMethod = useCallback(
    (method) => {
      setSettings(prev => ({ ...prev, paymentMethods: [...prev.paymentMethods, method] }));
      triggerToast('success', 'Payment Method Added', `${method} has been added.`);
    },
    [triggerToast],
  );

  const deletePaymentMethod = useCallback(
    (method) => {
      setSettings(prev => ({
        ...prev,
        paymentMethods: prev.paymentMethods.filter(m => m !== method)
      }));
      triggerToast('info', 'Payment Method Removed', `${method} has been deleted.`);
    },
    [triggerToast],
  );

  return { settings, updateBaseRate, addPaymentMethod, deletePaymentMethod };
}
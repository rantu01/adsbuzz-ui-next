import { useCallback, useState } from 'react';
import { INITIAL_CUSTOMERS } from '@/data/seedData';

export function useCustomers(triggerToast) {
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);

  const addCustomer = useCallback(
    (customerData) => {
      let generatedId = '';
      const today = new Date().toISOString().split('T')[0];

      setCustomers(prev => {
        const id = `CUST-${(prev.length + 101)}`;
        generatedId = id;
        const newCustomer = {
          ...customerData,
          id,
          createdAt: today,
          balanceBDT: 0,
          balanceUSD: 0,
        };
        return [newCustomer, ...prev];
      });

      const newCustomer = {
        ...customerData,
        id: generatedId,
        createdAt: today,
        balanceBDT: 0,
        balanceUSD: 0,
      };
      triggerToast('success', 'Customer Onboarded', `${customerData.name} added with ID ${generatedId}`);
      return newCustomer;
    },
    [triggerToast],
  );

  const updateCustomer = useCallback(
    (updatedCust) => {
      setCustomers(prev => prev.map(c => (c.id === updatedCust.id ? updatedCust : c)));
      triggerToast('success', 'Customer Updated', `Profile updated for ${updatedCust.name}`);
    },
    [triggerToast],
  );

  const updateCustomerNotes = useCallback(
    (customerId, notes) => {
      setCustomers(prev => prev.map(c => (c.id === customerId ? { ...c, notes } : c)));
      triggerToast('success', 'CRM Notes Updated', 'Customer relationship records synchronized.');
    },
    [triggerToast],
  );

  const toggleFavorite = useCallback(
    (customerId) => {
      setCustomers(prev => {
        const target = prev.find(c => c.id === customerId);
        if (target) {
          const nextState = !target.favorite;
          triggerToast(
            'info',
            nextState ? 'Added to Favorites' : 'Removed from Favorites',
            `${target.name} bookmarks toggled.`,
          );
        }
        return prev.map(c =>
          c.id === customerId ? { ...c, favorite: !c.favorite } : c,
        );
      });
    },
    [triggerToast],
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

  return {
    customers,
    addCustomer,
    updateCustomer,
    updateCustomerNotes,
    toggleFavorite,
    applySaleCredit,
  };
}
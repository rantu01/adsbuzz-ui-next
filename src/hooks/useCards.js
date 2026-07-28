import { useCallback, useState } from 'react';
import { INITIAL_CARDS } from '@/data/seedData';

export function useCards(triggerToast) {
  const [cards, setCards] = useState(INITIAL_CARDS);

  const addCard = useCallback(
    (newCard) => {
      setCards(prev => [...prev, newCard]);
      triggerToast('success', 'Card Registered', `Successfully added corporate card: ${newCard.cardName}`);
    },
    [triggerToast],
  );

  const updateCard = useCallback(
    (updatedCard) => {
      setCards(prev => prev.map(c => (c.id === updatedCard.id ? updatedCard : c)));
      triggerToast('success', 'Card Updated', `Updated settings for ${updatedCard.cardName}`);
    },
    [triggerToast],
  );

  const toggleCardStatus = useCallback(
    (cardId) => {
      setCards(prev =>
        prev.map(c => {
          if (c.id !== cardId) return c;
          const nextStatus = c.status === 'Active' ? 'Disable' : 'Active';
          triggerToast('warning', 'Card Policy Modified', `Card ${c.cardName} set to ${nextStatus}.`);
          return { ...c, status: nextStatus };
        }),
      );
    },
    [triggerToast],
  );

  const applyCardLoad = useCallback((cardName, topupAmountUSD) => {
    setCards(prev =>
      prev.map(card =>
        card.cardName === cardName
          ? {
              ...card,
              usageCount: card.usageCount + 1,
              totalLoadedUSD: card.totalLoadedUSD + topupAmountUSD,
            }
          : card,
      ),
    );
  }, []);

  return { cards, addCard, updateCard, toggleCardStatus, applyCardLoad };
}
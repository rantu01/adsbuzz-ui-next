import { useCallback, useEffect, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';

export function useCards(triggerToast) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCards = useCallback(async () => {
    try {
      const data = await apiFetch('/api/cards');
      setCards(data.cards || []);
      setError(null);
    } catch (err) {
      setError(err);
      triggerToast('error', 'Load Failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const addCard = useCallback(
    async (newCard) => {
      try {
        const data = await apiFetch('/api/cards', {
          method: 'POST',
          body: JSON.stringify(newCard),
        });
        setCards(prev => [data.card, ...prev]);
        triggerToast('success', 'Card Registered', `Successfully added corporate card: ${data.card.cardName}`);
        return data.card;
      } catch (err) {
        triggerToast('error', 'Failed to Register Card', getErrorMessage(err));
        throw err;
      }
    },
    [triggerToast],
  );

  const updateCard = useCallback(
    async (objOrId, updates) => {
      const cardObj = typeof objOrId === 'object' ? objOrId : { id: objOrId, ...updates };
      const id = cardObj.id;

      // Optimistic update, roll back on failure
      const prev = cards.find(c => c.id === id);
      if (prev) setCards(prevCards => prevCards.map(c => (c.id === id ? { ...c, ...cardObj } : c)));

      try {
        const data = await apiFetch(`/api/cards/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(cardObj),
        });
        const saved = data.card;
        setCards(prevCards => prevCards.map(c => (c.id === saved.id ? saved : c)));
        triggerToast('success', 'Card Updated', `Updated settings for ${saved.cardName}`);
        return saved;
      } catch (err) {
        if (prev) setCards(prevCards => prevCards.map(c => (c.id === id ? prev : c)));
        triggerToast('error', 'Failed to Update Card', getErrorMessage(err));
        throw err;
      }
    },
    [cards, triggerToast],
  );

  const toggleCardStatus = useCallback(
    async (cardId) => {
      const prev = cards.find(c => c.id === cardId);
      const nextStatus = prev?.status === 'Active' ? 'Disabled' : 'Active';

      // Optimistic toggle
      if (prev) setCards(prevCards => prevCards.map(c => (c.id === cardId ? { ...c, status: nextStatus } : c)));

      try {
        const data = await apiFetch(`/api/cards/${encodeURIComponent(cardId)}`, {
          method: 'PATCH',
          body: JSON.stringify({ statusOnly: true }),
        });
        const card = data.card;
        setCards(prevCards => prevCards.map(c => (c.id === card.id ? card : c)));
        triggerToast('warning', 'Card Policy Modified', `Card ${card.cardName} set to ${card.status}.`);
        return card;
      } catch (err) {
        if (prev) setCards(prevCards => prevCards.map(c => (c.id === cardId ? prev : c)));
        triggerToast('error', 'Failed to Toggle Card', getErrorMessage(err));
        throw err;
      }
    },
    [cards, triggerToast],
  );

  const applyCardLoad = useCallback(
    async (cardName, topupAmountUSD) => {
      try {
        const data = await apiFetch('/api/cards/load', {
          method: 'POST',
          body: JSON.stringify({ cardName, topupAmountUSD }),
        });
        if (data?.card) {
          setCards(prev => prev.map(card => (card.id === data.card.id ? data.card : card)));
        }
        return data?.card || null;
      } catch (err) {
        return null;
      }
    },
    [],
  );

  const refetch = useCallback(() => {
    setLoading(true);
    return fetchCards();
  }, [fetchCards]);

  const deleteCard = useCallback(
    async (cardId) => {
      const prev = cards.find(c => c.id === cardId);
      if (!prev) return null;

      setCards(prevCards => prevCards.filter(c => c.id !== cardId));

      try {
        const data = await apiFetch(`/api/cards/${encodeURIComponent(cardId)}`, {
          method: 'DELETE',
        });
        const removed = data.card;
        return removed;
      } catch (err) {
        setCards(prevCards =>
          prevCards.some(c => c.id === cardId) ? prevCards : [prev, ...prevCards],
        );
        throw err;
      }
    },
    [cards,],
  );

  return { cards, loading, error, addCard, updateCard, toggleCardStatus, applyCardLoad, deleteCard, refetch };
}
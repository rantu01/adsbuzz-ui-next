import { useCallback, useEffect, useState } from 'react';

export function useCards(triggerToast) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCards = useCallback(async () => {
    try {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('Failed to load cards');
      const data = await res.json();
      setCards(data.cards || []);
    } catch (err) {
      triggerToast('error', 'Load Failed', err.message);
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const addCard = useCallback(
    (newCard) => {
      fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCard),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to register card');
          }
          return res.json();
        })
        .then((data) => {
          setCards(prev => [...prev, data.card]);
          triggerToast('success', 'Card Registered', `Successfully added corporate card: ${data.card.cardName}`);
        })
        .catch((err) => triggerToast('error', 'Failed to Register Card', err.message));
    },
    [triggerToast],
  );

  const updateCard = useCallback(
    (updatedCard) => {
      fetch(`/api/cards/${updatedCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCard),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to update card');
          }
          return res.json();
        })
        .then((data) => {
          setCards(prev => prev.map(c => (c.id === data.card.id ? data.card : c)));
          triggerToast('success', 'Card Updated', `Updated settings for ${data.card.cardName}`);
        })
        .catch((err) => triggerToast('error', 'Failed to Update Card', err.message));
    },
    [triggerToast],
  );

  const toggleCardStatus = useCallback(
    (cardId) => {
      fetch(`/api/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusOnly: true }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to toggle card status');
          }
          return res.json();
        })
        .then((data) => {
          const card = data.card;
          setCards(prev => prev.map(c => (c.id === card.id ? card : c)));
          triggerToast('warning', 'Card Policy Modified', `Card ${card.cardName} set to ${card.status}.`);
        })
        .catch((err) => triggerToast('error', 'Failed to Toggle Card', err.message));
    },
    [triggerToast],
  );

  const applyCardLoad = useCallback(
    (cardName, topupAmountUSD) => {
      fetch('/api/cards/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardName, topupAmountUSD }),
      })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          setCards(prev => prev.map(card => (card.id === data.card.id ? data.card : card)));
        })
        .catch(() => {});
    },
    [],
  );

  return { cards, loading, addCard, updateCard, toggleCardStatus, applyCardLoad };
}
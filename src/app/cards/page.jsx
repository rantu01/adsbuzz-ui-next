'use client';

import { useApp } from '@/context/AppContext';
import CardsView from '@/components/views/CardsView';

export default function CardsPage() {
  const app = useApp();

  return (
    <CardsView
      cards={app.cards}
      error={app.cardsError}
      onRetry={app.refetchCards}
      adAccounts={app.adAccounts}
      platforms={app.platforms}
      wallets={app.wallets}
      onUpdateCard={app.updateCard}
      onAddCard={app.addCard}
      onToggleCardStatus={app.handleToggleCardStatus}
      onDeleteCard={app.handleDeleteCard}
    />
  );
}

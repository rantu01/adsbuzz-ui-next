'use client';

import { useApp } from '@/context/AppContext';
import WalletsView from '@/components/views/WalletsView';

export default function WalletsPage() {
  const app = useApp();

  return (
    <WalletsView
      wallets={app.wallets}
      error={app.walletsError}
      onRetry={app.refetchWallets}
      onUpdateWallet={app.handleUpdateWallet}
      onAddWallet={app.addWallet}
      onDeleteWallet={app.handleDeleteWallet}
    />
  );
}

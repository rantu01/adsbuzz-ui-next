'use client';
import { useApp } from '@/context/AppContext';
import OfficeWalletView from '@/components/views/OfficeWalletView';

export default function OfficeWalletPage() {
  const app = useApp();
  return (
    <OfficeWalletView
      officeExpenseFund={app.officeExpenseFund}
      officeExpenseFundTransactions={app.officeExpenseFundTransactions}
      officeExpenseFundLoading={app.officeExpenseFundLoading}
      officeExpenseFundError={app.officeExpenseFundError}
      onRetryFund={app.refetchOfficeExpenseFund}
      onAddFunds={app.handleAddOfficeExpenseFunds}
    />
  );
}

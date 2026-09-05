'use client';
import { useApp } from '@/context/AppContext';
import OfficeExpenseEntryView from '@/components/views/OfficeExpenseEntryView';

export default function OfficeExpenseEntryPage() {
  const app = useApp();
  return (
    <OfficeExpenseEntryView
      officeExpenses={app.officeExpenses}
      officeExpenseEntries={app.officeExpenseEntries}
      officeExpenseEntriesError={app.officeExpenseEntriesError}
      officeExpenseMonths={app.officeExpenseMonths}
      officeExpenseFund={app.officeExpenseFund}
      officeExpenseFundTransactions={app.officeExpenseFundTransactions}
      officeExpenseFundLoading={app.officeExpenseFundLoading}
      officeExpenseFundError={app.officeExpenseFundError}
      onRetryEntries={app.refetchOfficeExpenseEntries}
      onRetryMonths={app.refetchOfficeExpenseMonths}
      onRetryFund={app.refetchOfficeExpenseFund}
      onAddEntry={app.handleAddOfficeExpenseEntry}
      onUpdateEntry={app.handleUpdateOfficeExpenseEntry}
      onDeleteEntry={app.handleDeleteOfficeExpenseEntry}
      onAddMonth={app.handleAddOfficeExpenseMonth}
      onUpdateMonth={app.handleUpdateOfficeExpenseMonth}
      onAddFunds={app.handleAddOfficeExpenseFunds}
    />
  );
}

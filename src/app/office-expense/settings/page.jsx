'use client';
import { useApp } from '@/context/AppContext';
import OfficeExpensesView from '@/components/views/OfficeExpensesView';

export default function OfficeExpenseSettingsPage() {
  const app = useApp();
  return (
    <OfficeExpensesView
      officeExpenses={app.officeExpenses}
      error={app.officeExpensesError}
      onRetry={app.refetchOfficeExpenses}
      onAddOfficeExpense={app.handleAddOfficeExpense}
      onUpdateOfficeExpense={app.handleUpdateOfficeExpense}
      onDeleteOfficeExpense={app.handleDeleteOfficeExpense}
    />
  );
}

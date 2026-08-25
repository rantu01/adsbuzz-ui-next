'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import StatCard from '@/components/common/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useOfficeExpenseDashboard } from '@/hooks/useOfficeExpenseDashboard';

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US')}`;
}

function formatMonthLabel(month) {
  if (!month) return '';
  const [y, m] = month.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function OfficeExpenseDashboardView({ officeExpenses, onRetry }) {
  const [year, setYear] = useState(null);
  const { dashboard, loading, error, refetch } = useOfficeExpenseDashboard(year);

  useEffect(() => {
    if (dashboard && !year && dashboard.year) setYear(dashboard.year);
  }, [dashboard, year]);

  const categories = useMemo(
    () => (officeExpenses || []).map((c) => c.mainCategory),
    [officeExpenses],
  );

  const latestCashInHand = useMemo(() => {
    if (!dashboard) return 0;
    const months = dashboard.months || [];
    const last = months[months.length - 1];
    return last ? dashboard.cashInHand?.[last] || 0 : 0;
  }, [dashboard]);

  const matrix = dashboard?.matrix || {};
  const monthTotals = dashboard?.monthTotals || {};
  const months = dashboard?.months || [];
  const cashInHand = dashboard?.cashInHand || {};

  const rows = categories.length > 0 ? categories : Object.keys(matrix);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <LayoutDashboard size={22} className="text-brand-orange" />
            Office Expense Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Yearly and monthly office expense summaries computed from stored records.
          </p>
        </div>
        {dashboard?.years?.length > 0 && (
          <select
            value={year || dashboard.year || ''}
            onChange={(e) => setYear(e.target.value)}
            className="text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700"
          >
            {dashboard.years.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="YEAR TOTAL EXPENSE"
          value={formatBDT(dashboard?.yearTotal || 0)}
          variant="blue"
          subtext={`Year ${dashboard?.year || '-'}`}
          icon={<Receipt size={20} />}
        />
        <StatCard
          title="TOTAL ENTRIES"
          value={dashboard?.totalEntries || 0}
          variant="amber"
          subtext="Vouchers recorded"
          icon={<BarChart3 size={20} />}
        />
        <StatCard
          title="MONTHS RECORDED"
          value={months.length}
          variant="emerald"
          subtext="In this year"
          icon={<CalendarDays size={20} />}
        />
        <StatCard
          title="CASH IN HAND"
          value={formatBDT(latestCashInHand)}
          variant="rose"
          subtext="Latest month"
          icon={<Wallet size={20} />}
        />
      </div>

      <div
        id="office-expense-dashboard-card"
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto"
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <th className="text-left font-bold px-4 py-3 sticky left-0 bg-slate-50 dark:bg-slate-800/60">
                Category
              </th>
              {months.map((m) => (
                <th key={m} className="text-right font-bold px-4 py-3 whitespace-nowrap">
                  {formatMonthLabel(m)}
                </th>
              ))}
              <th className="text-right font-bold px-4 py-3 whitespace-nowrap border-l border-slate-200 dark:border-slate-700">
                Year Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cat) => (
              <tr key={cat} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900">
                  {cat}
                </td>
                {months.map((m) => (
                  <td key={m} className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {formatBDT(matrix[cat]?.[m] || 0)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700 whitespace-nowrap">
                  {formatBDT(dashboard?.categoryTotals?.[cat] || 0)}
                </td>
              </tr>
            ))}

            <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/40">
              <td className="px-4 py-3 font-bold text-slate-800 dark:text-white sticky left-0 bg-slate-50 dark:bg-slate-800/40">
                Total
              </td>
              {months.map((m) => (
                <td key={m} className="px-4 py-3 text-right font-bold text-slate-800 dark:text-white whitespace-nowrap">
                  {formatBDT(monthTotals[m] || 0)}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-brand-blue-deep border-l border-slate-200 dark:border-slate-700 whitespace-nowrap">
                {formatBDT(dashboard?.yearTotal || 0)}
              </td>
            </tr>

            <tr className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2.5 font-semibold text-slate-500 sticky left-0 bg-white dark:bg-slate-900">
                Cash In Hand
              </td>
              {months.map((m) => (
                <td key={m} className="px-4 py-2.5 text-right text-slate-500 whitespace-nowrap">
                  {formatBDT(cashInHand[m] || 0)}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right text-slate-500 border-l border-slate-200 dark:border-slate-700 whitespace-nowrap">
                {formatBDT(latestCashInHand)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OfficeExpenseDashboardView;

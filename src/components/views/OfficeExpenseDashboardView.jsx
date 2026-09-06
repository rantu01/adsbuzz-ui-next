'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  CalendarDays,
  CalendarRange,
  CalendarClock,
  Layers,
  Hourglass,
  CheckCircle2,
  XCircle,
  PieChart as PieChartIcon,
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import StatCard from '@/components/common/StatCard';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useOfficeExpenseOverview } from '@/hooks/useOfficeExpenseOverview';

// Project palette (brand orange/blue first, then supporting tones).
const CHART_COLORS = [
  '#F68B2D',
  '#1F5F98',
  '#10B981',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#6366F1',
  '#EF4444',
  '#64748B',
];

function formatBDT(n) {
  const num = Number(n) || 0;
  return `৳${num.toLocaleString('en-US')}`;
}

function getCurrentYear() {
  return String(new Date().getFullYear());
}

function getCurrentMonthCode() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '';
  const [y, m] = month.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatMonthShort(month) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return month || '';
  const [y, m] = month.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

const EMPTY_YEAR = { total: 0, vouchers: 0, months: [], monthsRecorded: 0, avgMonthly: 0, categories: [] };
const EMPTY_MONTH = { total: 0, entries: 0, categories: [] };

function CategoryDetails({ title, subtitle, categories, total }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        <p className="text-xs text-slate-400 py-8 text-center">No expense records for this period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      <ul className="mt-4 space-y-3">
        {categories.map((c, i) => (
          <li key={c.category}>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                {c.category}
              </span>
              <span className="font-black text-slate-900 dark:text-white whitespace-nowrap">{formatBDT(c.total)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, c.pct)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>{c.entries} {c.entries === 1 ? 'entry' : 'entries'}</span>
              <span className="font-bold">{c.pct}% of {formatBDT(total)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DistributionChart({ title, subtitle, categories }) {
  const data = (categories || []).map((c) => ({ name: c.category, value: Number(c.total) || 0 }));
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex flex-col">
      <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      {data.length === 0 ? (
        <p className="text-xs text-slate-400 py-8 text-center flex-1">No data to chart for this period.</p>
      ) : (
        <div className="h-72 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="78%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
                labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(1)}%`}
                fontSize={11}
                fontWeight={700}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [formatBDT(v), name]}
                contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function OfficeExpenseDashboardView() {
  const { overview, loading, error, refetch } = useOfficeExpenseOverview();
  const [year, setYear] = useState(() => getCurrentYear());
  const [monthYear, setMonthYear] = useState(() => getCurrentYear());
  const [month, setMonth] = useState(() => getCurrentMonthCode());

  const currentYear = useMemo(() => getCurrentYear(), []);
  const currentMonthCode = useMemo(() => getCurrentMonthCode(), []);

  const yearOptions = useMemo(() => {
    const set = new Set([...(overview?.years || []), currentYear]);
    return [...set].sort();
  }, [overview, currentYear]);

  // Keep the selected year valid once data arrives.
  useEffect(() => {
    if (!overview) return;
    if (!yearOptions.includes(year)) setYear(yearOptions[yearOptions.length - 1] || currentYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview]);

  const yearStats = overview?.byYear?.[year] || EMPTY_YEAR;

  // Months with records in the selected month-year, oldest → newest.
  const monthOptions = useMemo(() => {
    if (!overview?.byMonth) return [];
    return Object.keys(overview.byMonth)
      .filter((m) => m.startsWith(`${monthYear}-`))
      .sort();
  }, [overview, monthYear]);

  // Default to the running month when it has records, else the latest recorded month.
  useEffect(() => {
    if (!overview) return;
    if (monthOptions.length === 0) return;
    if (monthYear === currentYear && monthOptions.includes(currentMonthCode)) {
      setMonth(currentMonthCode);
    } else if (!monthOptions.includes(month)) {
      setMonth(monthOptions[monthOptions.length - 1]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overview, monthYear]);

  const handleMonthYearChange = (y) => {
    setMonthYear(y);
  };

  const monthStats = overview?.byMonth?.[month] || EMPTY_MONTH;
  // Historical months never show the live balance — only the running month does.
  const monthCashInHand = month === currentMonthCode ? Number(overview?.cashInHand || 0) : 0;

  const lifetime = overview?.lifetime || { total: 0, vouchers: 0 };
  const approvals = overview?.approvalCounts || { pending: 0, approved: 0, rejected: 0 };
  const thisYearStats = overview?.byYear?.[currentYear] || EMPTY_YEAR;
  const thisMonthStats = overview?.byMonth?.[currentMonthCode] || EMPTY_MONTH;

  const selectClass =
    'text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-orange outline-none dark:bg-slate-800 dark:border-slate-700';

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <LayoutDashboard size={22} className="text-brand-orange" />
          Office Expense Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lifetime, yearly and monthly office expense insights computed from stored records.
        </p>
      </div>

      {error && <ErrorBanner error={error} onRetry={refetch} />}

      {loading && !overview ? (
        <div className="p-16 text-center text-slate-400 dark:text-slate-500">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand-orange" />
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Loading dashboard…</h4>
          <p className="text-xs mt-1">Aggregating expense records.</p>
        </div>
      ) : (
        <>
          {/* ---- 1. Top summary boxes ---- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="CASH IN HAND"
              value={formatBDT(overview?.cashInHand || 0)}
              variant="emerald"
              subtext="Current balance"
              icon={<Wallet size={20} />}
            />
            <StatCard
              title="LIFETIME EXPENSE"
              value={formatBDT(lifetime.total)}
              variant="blue"
              subtext={`${lifetime.vouchers} Vouchers`}
              icon={<Receipt size={20} />}
            />
            <StatCard
              title="THIS YEAR EXPENSE"
              value={formatBDT(thisYearStats.total)}
              variant="amber"
              subtext={`${thisYearStats.monthsRecorded} Months Recorded`}
              icon={<CalendarRange size={20} />}
            />
            <StatCard
              title="THIS MONTH EXPENSE"
              value={formatBDT(thisMonthStats.total)}
              variant="purple"
              subtext={`${thisMonthStats.entries} Vouchers`}
              icon={<CalendarClock size={20} />}
            />
            <StatCard
              title="TOTAL MONTH RECORDED"
              value={overview?.totalMonthsRecorded || 0}
              variant="slate"
              subtext="Unique months"
              icon={<CalendarDays size={20} />}
            />
            <StatCard
              title="EXPENSE APPROVAL PENDING"
              value={approvals.pending || 0}
              variant="amber"
              subtext="Awaiting approval"
              icon={<Hourglass size={20} />}
            />
            <StatCard
              title="EXPENSE APPROVED"
              value={approvals.approved || 0}
              variant="emerald"
              subtext="Approved entries"
              icon={<CheckCircle2 size={20} />}
            />
            <StatCard
              title="EXPENSE REJECTED"
              value={approvals.rejected || 0}
              variant="rose"
              subtext="Rejected entries"
              icon={<XCircle size={20} />}
            />
          </div>

          {/* ---- 2. Yearly expense insights ---- */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-brand-blue" />
                Yearly Expense Insights
              </h2>
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                Year
                <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass} aria-label="Select year">
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="TOTAL EXPENSE"
                value={formatBDT(yearStats.total)}
                variant="blue"
                subtext={`Year ${year}`}
                icon={<Receipt size={20} />}
              />
              <StatCard
                title="TOTAL NO. OF VOUCHERS"
                value={yearStats.vouchers}
                variant="amber"
                subtext={`Year ${year}`}
                icon={<PieChartIcon size={20} />}
              />
              <StatCard
                title="MONTHS RECORDED"
                value={yearStats.monthsRecorded}
                variant="emerald"
                subtext={yearStats.monthsRecorded === 1 ? '1 Month Recorded' : `${yearStats.monthsRecorded} Months Recorded`}
                icon={<CalendarDays size={20} />}
              />
              <StatCard
                title="AVERAGE MONTHLY EXPENSE"
                value={formatBDT(yearStats.avgMonthly)}
                variant="purple"
                subtext="Recorded months only"
                icon={<Wallet size={20} />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryDetails
                title="Category-wise Expense Details"
                subtitle={`Year ${year} · sorted by highest expense`}
                categories={yearStats.categories}
                total={yearStats.total}
              />
              <DistributionChart
                title="Yearly Expense Distribution"
                subtitle={`Year ${year} · by category`}
                categories={yearStats.categories}
              />
            </div>
          </section>

          {/* ---- 3. Monthly expense insights ---- */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarDays size={18} className="text-brand-orange" />
                Monthly Expense Insights
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                <label className="flex items-center gap-2">
                  Year
                  <select value={monthYear} onChange={(e) => handleMonthYearChange(e.target.value)} className={selectClass} aria-label="Select month year">
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  Month
                  <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass} aria-label="Select month">
                    {monthOptions.length === 0 && <option value="">No months</option>}
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {formatMonthLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                title="TOTAL EXPENSE"
                value={formatBDT(monthStats.total)}
                variant="blue"
                subtext={formatMonthShort(month)}
                icon={<Receipt size={20} />}
              />
              <StatCard
                title="TOTAL NO. OF ENTRIES"
                value={monthStats.entries}
                variant="amber"
                subtext={formatMonthShort(month)}
                icon={<PieChartIcon size={20} />}
              />
              <StatCard
                title="CASH IN HAND"
                value={formatBDT(monthCashInHand)}
                variant="emerald"
                subtext={month === currentMonthCode ? 'Current balance' : 'Historical month'}
                icon={<Wallet size={20} />}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CategoryDetails
                title="Category-wise Expense Details"
                subtitle={`${formatMonthLabel(month)} · sorted by highest expense`}
                categories={monthStats.categories}
                total={monthStats.total}
              />
              <DistributionChart
                title="Monthly Expense Distribution"
                subtitle={`${formatMonthLabel(month)} · by category`}
                categories={monthStats.categories}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default OfficeExpenseDashboardView;

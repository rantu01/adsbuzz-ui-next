'use client';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart2, Building2, Calendar, CalendarDays, Check, ChevronLeft, ChevronRight, CreditCard, DollarSign, Download, Landmark, Layers, Loader2, TrendingUp } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import SearchBar from '@/components/ui/SearchBar';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { apiFetch } from '@/utils/api';

function alignClass(align) {
  return align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
}

function ReportTable({ columns, rows, footer }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50/80 dark:bg-slate-800/60 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={`py-2.5 px-3 first:pl-4 whitespace-nowrap uppercase tracking-wider text-[10px] ${alignClass(c.align)}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8 text-slate-400 font-medium italic bg-slate-50/50 dark:bg-slate-900/50">
                No records found for this month.
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`py-2.5 px-3 first:pl-4 whitespace-nowrap ${cell.className || ''} ${alignClass(columns[j]?.align)}`}>
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="bg-surface-blue border-t-2 border-border-blue-light text-brand-blue-deep font-extrabold">
              {footer.map((cell, j) => (
                <td key={j} className={`py-2.5 px-3 first:pl-4 whitespace-nowrap ${cell.className || ''} ${alignClass(columns[j]?.align)}`}>
                  {cell.text}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function ReportCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-border-blue-light bg-surface-blue-light p-4 shadow-[0_12px_30px_rgba(12,66,117,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          {subtitle && <p className="mt-1 text-[11px] font-semibold text-slate-500">{subtitle}</p>}
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-600 bg-white/80 border border-border-blue-light">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatusDot({ color }) {
  return <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: color }} />;
}

function ReportsView({ invoices, onTriggerExport, onDownloadAdAccountStatement }) {
  const [platform, setPlatform] = useState('All');
  const [search, setSearch] = useState('');
  const [statementGroup, setStatementGroup] = useState('');
  const [statementAdAccount, setStatementAdAccount] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // ====== Server-computed monthly report (from /api/reports) ======
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const loadReport = useCallback(async (month) => {
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await apiFetch(`/api/reports?month=${encodeURIComponent(month)}`);
      setReport(data.report);
    } catch (err) {
      setReportError(err);
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport(reportMonth);
  }, [reportMonth, loadReport]);

  // ====== Client-side fallbacks (instant paint, matched by server report) ======
  const monthFilteredInvoices = invoices.filter(inv => {
    if (!inv.date) return false;
    return inv.date.startsWith(reportMonth);
  });

  const clientTotalSellUSD = monthFilteredInvoices.reduce((s, inv) => s + (inv.topupAmountUSD || 0), 0);
  const clientTotalSellBDT = monthFilteredInvoices.reduce((s, inv) => s + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);
  const clientCount = monthFilteredInvoices.length;
  const clientAvgSellUSD = clientCount > 0 ? clientTotalSellUSD / clientCount : 0;
  const clientAvgSellBDT = clientCount > 0 ? clientTotalSellBDT / clientCount : 0;
  const clientAdTopupInvoices = monthFilteredInvoices.filter(inv => inv.serviceType !== 'Others');
  const clientAdTopupUSD = clientAdTopupInvoices.reduce((s, inv) => s + (inv.topupAmountUSD || 0), 0);
  const clientAdTopupBDT = clientAdTopupInvoices.reduce((s, inv) => s + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);
  const clientAvgPerDollarBDT = clientTotalSellUSD > 0 ? clientTotalSellBDT / clientTotalSellUSD : 0;

  const metrics = report?.metrics ?? {
    totalSellUSD: clientTotalSellUSD,
    totalSellBDT: clientTotalSellBDT,
    avgSellUSD: clientAvgSellUSD,
    avgSellBDT: clientAvgSellBDT,
    adTopupUSD: clientAdTopupUSD,
    adTopupBDT: clientAdTopupBDT,
    avgPerDollarBDT: clientAvgPerDollarBDT,
  };

  const approval = report?.approval ?? {
    total: clientCount,
    approved: monthFilteredInvoices.filter(inv => (inv.approvalStatus || inv.paymentVerificationStatus || 'Approved') === 'Approved').length,
    declined: monthFilteredInvoices.filter(inv => (inv.approvalStatus || inv.paymentVerificationStatus || 'Approved') === 'Rejected' || (inv.approvalStatus || inv.paymentVerificationStatus || 'Approved') === 'Declined').length,
  };

  const clientPaymentStatus = ['Paid', 'Due', 'Partially Paid'].map(status => {
    const rows = monthFilteredInvoices.filter(inv => inv.paymentStatus === status);
    return {
      status,
      count: rows.length,
      totalAmountBDT: rows.reduce((s, inv) => s + (inv.totalAmountBDT || 0), 0),
      paidAmountBDT: rows.reduce((s, inv) => s + (inv.paidAmountBDT || 0), 0),
      dueAmountBDT: rows.reduce((s, inv) => s + (inv.dueAmountBDT || 0), 0),
    };
  });
  const paymentStatus = report?.paymentStatus ?? clientPaymentStatus;

  // Available months for the selector (current + last 12 months of data)
  const availableMonths = (() => {
    const set = new Set();
    invoices.forEach(inv => {
      if (inv.date && inv.date.length >= 7) set.add(inv.date.substring(0, 7));
    });
    const cur = new Date().toISOString().substring(0, 7);
    set.add(cur);
    return Array.from(set).sort().reverse();
  })();

  // ====== Ad Account Statement selectors (derived from Sales Entry history) ======
  // A Group ID qualifies an Ad Account for a statement whenever that ad account
  // has at least one sales entry recorded against the group — regardless of its
  // current (or previous) assignment status. We derive both lists straight from
  // the invoice (sales entry) history the user already has loaded.
  const groupOptions = useMemo(() => {
    const set = new Set();
    invoices.forEach(inv => {
      const g = String(inv.groupId || '').trim();
      if (g) set.add(g);
    });
    return Array.from(set).sort();
  }, [invoices]);

  const adAccountOptions = useMemo(() => {
    if (!statementGroup) return [];
    const map = new Map();
    const normGroup = String(statementGroup).trim();
    invoices.forEach(inv => {
      if (String(inv.groupId || '').trim() !== normGroup) return;
      const name = String(inv.adAccountName || '').trim();
      if (!name) return;
      const id = String(inv.adAccountId || '').trim();
      const key = id || name;
      if (!map.has(key)) map.set(key, { id, name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices, statementGroup]);

  const handleStatementGroupChange = (e) => {
    setStatementGroup(e.target.value);
    setStatementAdAccount('');
  };

  const filtered = invoices.filter(inv => {
    const matchesPlatform = platform === 'All' ? true : inv.platform === platform;
    const matchesSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
                          inv.adAccountName.toLowerCase().includes(search.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageWindow = (() => {
    const pages = [];
    const max = totalPages;
    const current = safePage;
    pages.push(1);
    if (current > 3) pages.push('...');
    for (let p = Math.max(2, current - 1); p <= Math.min(max - 1, current + 1); p++) {
      pages.push(p);
    }
    if (current < max - 2) pages.push('...');
    if (max > 1) pages.push(max);
    return pages;
  })();

  useEffect(() => {
    setCurrentPage(1);
  }, [platform, search]);

  const formatUSD = (value) => `USD ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBDT = (value) => `BDT ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const percentOf = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

  // ====== Section data ======
  const statementMetrics = [
    {
      title: 'Total Sell',
      icon: DollarSign,
      background: '#FFF7ED',
      border: '#FBD9B9',
      iconBackground: '#FFE8D4',
      values: [
        { label: 'Total USD', value: formatUSD(metrics.totalSellUSD) },
        { label: 'Total BDT', value: formatBDT(metrics.totalSellBDT) },
      ],
    },
    {
      title: 'Average Sell',
      icon: TrendingUp,
      background: '#F0F7FF',
      border: '#CFE1F5',
      iconBackground: '#DCEBFA',
      values: [
        { label: 'Amount USD', value: formatUSD(metrics.avgSellUSD) },
        { label: 'Amount BDT', value: formatBDT(metrics.avgSellBDT) },
      ],
    },
    {
      title: 'Ads Topup',
      icon: BarChart2,
      background: '#F1FBF5',
      border: '#CFEBDD',
      iconBackground: '#DAF5E5',
      values: [
        { label: 'Topup USD', value: formatUSD(metrics.adTopupUSD) },
        { label: 'Topup BDT', value: formatBDT(metrics.adTopupBDT) },
      ],
    },
    {
      title: 'Avg Per USD Sale',
      icon: CreditCard,
      background: '#FFFBEA',
      border: '#F6E7A8',
      iconBackground: '#FEF3C7',
      values: [
        { label: 'BDT Rate', value: formatBDT(metrics.avgPerDollarBDT) },
      ],
    },
  ];

  const approvalRows = [
    { label: 'Total Requests', count: approval.total, background: '#F4F8FC', border: '#D8E6F3', bar: '#BFD7EA' },
    { label: 'Approved', count: approval.approved, background: '#F1FBF5', border: '#CFEBDD', bar: '#A7E5C0' },
    { label: 'Declined', count: approval.declined, background: '#FFF1F2', border: '#F8D6DC', bar: '#F8B4BE' },
  ];

  const STATUS_COLORS = { Paid: '#10B981', Due: '#F97316', 'Partially Paid': '#3B82F6' };

  const paymentStatusColumns = [
    { label: 'Status', align: 'left' },
    { label: 'Count', align: 'right' },
    { label: 'Total Amount', align: 'right' },
    { label: 'Paid', align: 'right' },
    { label: 'Due', align: 'right' },
  ];
  const paymentStatusRows = paymentStatus.map(s => [
    {
      text: (
        <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
          <StatusDot color={STATUS_COLORS[s.status] || '#94A3B8'} /> {s.status}
        </span>
      ),
      className: '',
    },
    { text: s.count.toLocaleString(), className: 'font-semibold text-slate-700' },
    { text: formatBDT(s.totalAmountBDT), className: 'font-semibold text-slate-900' },
    { text: formatBDT(s.paidAmountBDT), className: 'font-semibold text-emerald-600' },
    { text: formatBDT(s.dueAmountBDT), className: 'font-semibold text-rose-500' },
  ]);
  const paymentStatusFooter = (() => {
    const sum = (k) => paymentStatus.reduce((acc, s) => acc + Number(s[k] || 0), 0);
    return [
      { text: 'Total', className: '' },
      { text: paymentStatus.reduce((acc, s) => acc + s.count, 0).toLocaleString(), className: '' },
      { text: formatBDT(sum('totalAmountBDT')), className: '' },
      { text: formatBDT(sum('paidAmountBDT')), className: '' },
      { text: formatBDT(sum('dueAmountBDT')), className: '' },
    ];
  })();

  const platformColumns = [
    { label: 'Platform', align: 'left' },
    { label: 'Invoices', align: 'right' },
    { label: 'Total (USD)', align: 'right' },
    { label: 'Total (BDT)', align: 'right' },
    { label: 'Paid (BDT)', align: 'right' },
    { label: 'Due (BDT)', align: 'right' },
  ];
  const platformWise = report?.platformWise || [];
  const platformRows = platformWise.map(p => [
    { text: <PlatformText platform={p.platform} variant="text" className="font-bold text-slate-900" />, className: '' },
    { text: p.count.toLocaleString(), className: 'font-semibold text-slate-700' },
    { text: formatUSD(p.totalUSD), className: 'font-semibold text-slate-900' },
    { text: formatBDT(p.totalBDT), className: 'font-semibold text-slate-900' },
    { text: formatBDT(p.paidBDT), className: 'font-semibold text-emerald-600' },
    { text: formatBDT(p.dueBDT), className: 'font-semibold text-rose-500' },
  ]);
  const platformFooter = (() => {
    const sum = (k) => platformWise.reduce((acc, p) => acc + Number(p[k] || 0), 0);
    return [
      { text: 'All Platforms', className: '' },
      { text: platformWise.reduce((acc, p) => acc + p.count, 0).toLocaleString(), className: '' },
      { text: formatUSD(sum('totalUSD')), className: '' },
      { text: formatBDT(sum('totalBDT')), className: '' },
      { text: formatBDT(sum('paidBDT')), className: '' },
      { text: formatBDT(sum('dueBDT')), className: '' },
    ];
  })();

  const channelColumns = [
    { label: 'Payment Channel', align: 'left' },
    { label: 'Transactions', align: 'right' },
    { label: 'Received Amount', align: 'right' },
  ];
  const channelWise = report?.channelWise || [];
  const channelRows = channelWise.map(c => [
    { text: c.channel, className: 'font-bold text-slate-900' },
    { text: c.count.toLocaleString(), className: 'font-semibold text-slate-700' },
    { text: formatBDT(c.receivedBDT), className: 'font-extrabold text-slate-900' },
  ]);
  const channelFooter = [
    { text: 'All Channels', className: '' },
    { text: channelWise.reduce((acc, c) => acc + c.count, 0).toLocaleString(), className: '' },
    { text: formatBDT(channelWise.reduce((acc, c) => acc + Number(c.receivedBDT || 0), 0)), className: '' },
  ];

  const dailyColumns = [
    { label: 'Date', align: 'left' },
    { label: 'Invoices', align: 'right' },
    { label: 'Total (USD)', align: 'right' },
    { label: 'Total (BDT)', align: 'right' },
    { label: 'Paid (BDT)', align: 'right' },
    { label: 'Due (BDT)', align: 'right' },
  ];
  const dailyWise = report?.dailyWise || [];
  const dailyRows = dailyWise.map(d => [
    { text: d.date, className: 'font-mono font-bold text-slate-900' },
    { text: d.count.toLocaleString(), className: 'font-semibold text-slate-700' },
    { text: formatUSD(d.totalUSD), className: 'font-semibold text-slate-900' },
    { text: formatBDT(d.totalBDT), className: 'font-semibold text-slate-900' },
    { text: formatBDT(d.paidBDT), className: 'font-semibold text-emerald-600' },
    { text: formatBDT(d.dueBDT), className: 'font-semibold text-rose-500' },
  ]);
  const dailyFooter = (() => {
    const sum = (k) => dailyWise.reduce((acc, d) => acc + Number(d[k] || 0), 0);
    return [
      { text: 'Month Total', className: '' },
      { text: dailyWise.reduce((acc, d) => acc + d.count, 0).toLocaleString(), className: '' },
      { text: formatUSD(sum('totalUSD')), className: '' },
      { text: formatBDT(sum('totalBDT')), className: '' },
      { text: formatBDT(sum('paidBDT')), className: '' },
      { text: formatBDT(sum('dueBDT')), className: '' },
    ];
  })();

  const company = report?.company ?? { officeExpenseBDT: 0, vendorPaymentBDT: 0, refundBDT: 0, totalCompanyBDT: 0 };
  const companyRows = [
    { label: 'Office Expense', value: company.officeExpenseBDT },
    { label: 'Vendor Payment', value: company.vendorPaymentBDT },
    { label: 'Refund', value: company.refundBDT },
  ];

  return (
    <div className="space-y-6 animate-fade-in" id="reports-view">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Reporting Desk</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Audit billing transactions, cross-reference EBL gateway payments, and generate official statements.</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shadow-xs">
          <Calendar size={14} className="text-brand-orange" />
          <label className="text-[10px] uppercase font-bold text-slate-500">Report Month</label>
          <select
            value={reportMonth}
            onChange={(e) => setReportMonth(e.target.value)}
            className="text-xs font-bold bg-transparent focus:outline-none cursor-pointer text-slate-800 dark:text-slate-200"
          >
            {availableMonths.length === 0 && <option value={reportMonth}>{reportMonth}</option>}
            {availableMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {reportError && (
        <div className="max-w-6xl">
          <ErrorBanner error={reportError} onRetry={() => loadReport(reportMonth)} title="Could not load report data" />
        </div>
      )}

      <div className="max-w-6xl space-y-4 text-slate-900 dark:text-slate-100" id="reports-six-functions">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {statementMetrics.map(metric => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.title}
                className="rounded-2xl border p-4 shadow-[0_12px_30px_rgba(12,66,117,0.07)] text-slate-900"
                style={{ backgroundColor: metric.background, borderColor: metric.border }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase font-bold tracking-wide text-slate-700">{metric.title}</p>
                    <p className="mt-1 text-[10px] font-semibold text-slate-500">Monthly statement</p>
                  </div>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-700"
                    style={{ backgroundColor: metric.iconBackground }}
                  >
                    <Icon size={16} strokeWidth={1.8} />
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {metric.values.map(item => (
                    <div key={item.label} className="flex items-end justify-between gap-3">
                      <span className="text-[10px] uppercase font-bold tracking-wide text-slate-600">{item.label}</span>
                      <span className="text-right text-[15px] leading-tight sm:text-base font-black text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border-blue-light bg-surface-blue-light p-4 shadow-[0_12px_30px_rgba(12,66,117,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Payment Approval Status</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Approval flow for selected month</p>
              </div>
              <Check size={17} strokeWidth={1.8} className="text-slate-600" />
            </div>

            <div className="mt-4 space-y-2.5">
              {approvalRows.map(row => {
                const progress = percentOf(row.count, Math.max(approval.total, 1));
                return (
                  <div
                    key={row.label}
                    className="rounded-xl border px-3 py-2.5"
                    style={{ backgroundColor: row.background, borderColor: row.border }}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-700">{row.label}</span>
                      <span className="font-extrabold text-slate-900">{row.count.toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/80">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${row.count > 0 ? Math.max(progress, 5) : 0}%`, backgroundColor: row.bar }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border-blue-light bg-surface-blue-light p-4 shadow-[0_12px_30px_rgba(12,66,117,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Payment Status Report</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Amounts by collection state</p>
              </div>
              <CreditCard size={17} strokeWidth={1.8} className="text-slate-600" />
            </div>

            <div className="mt-4 rounded-xl border border-border-blue-light bg-white/75 dark:bg-slate-900/60 overflow-hidden">
              <ReportTable columns={paymentStatusColumns} rows={paymentStatusRows} footer={paymentStatusFooter} />
            </div>
          </div>
        </div>

        {!report ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 p-8 flex items-center justify-center gap-3 text-slate-500 text-sm font-semibold">
            <Loader2 size={16} className="animate-spin text-brand-orange" />
            {reportLoading ? 'Preparing report data…' : 'Waiting for report data…'}
          </div>
        ) : (
          <>
            {/* 1) Platform-Wise Sales Report */}
            <ReportCard icon={Layers} title="Platform-Wise Sales Report" subtitle="Sales split across publisher platforms">
              <div className="rounded-xl border border-border-blue-light bg-white/75 dark:bg-slate-900/60 overflow-hidden">
                <ReportTable columns={platformColumns} rows={platformRows} footer={platformFooter} />
              </div>
            </ReportCard>

            {/* 3) Payment Channel-Wise Report */}
            <ReportCard icon={Landmark} title="Payment Channel-Wise Report" subtitle="Received amounts by bank / mobile wallet channel">
              <div className="rounded-xl border border-border-blue-light bg-white/75 dark:bg-slate-900/60 overflow-hidden">
                <ReportTable columns={channelColumns} rows={channelRows} footer={channelFooter} />
              </div>
            </ReportCard>

            {/* 4) Day-Wise Sales Report */}
            <ReportCard icon={CalendarDays} title="Day-Wise Sales Report" subtitle="Daily sales activity for the selected month">
              <div className="rounded-xl border border-border-blue-light bg-white/75 dark:bg-slate-900/60 overflow-hidden">
                <ReportTable columns={dailyColumns} rows={dailyRows} footer={dailyFooter} />
              </div>
            </ReportCard>

            {/* 5) Company Expense Summary */}
            <div className="rounded-2xl border border-border-blue-light bg-surface p-4 shadow-[0_12px_30px_rgba(12,66,117,0.06)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Company Expense Summary</h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">Live expense and vendor ledger in BDT</p>
                </div>
                <span className="w-fit rounded-full border border-border-orange bg-surface-orange px-3 py-1 text-[11px] font-bold text-[#9a4a05]">
                  Total {formatBDT(company.totalCompanyBDT)}
                </span>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-border-blue-light bg-white/75 dark:bg-slate-900/60">
                {companyRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between gap-4 border-b border-border-blue-light px-3 py-3 last:border-b-0">
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <Building2 size={14} className="text-slate-400" />
                      {row.label}
                    </span>
                    <span className="text-right text-xs font-extrabold text-slate-900">{formatBDT(row.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-surface-blue px-3 py-3 border-t border-border-blue-light">
                  <span className="text-xs font-extrabold text-brand-blue-deep">Total</span>
                  <span className="text-right text-sm font-black text-brand-blue-deep">{formatBDT(company.totalCompanyBDT)}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 max-w-6xl">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Statement Generator</h3>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Select Month</label>
            <select
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
            >
              {availableMonths.length === 0 && <option value={reportMonth}>{reportMonth}</option>}
              {availableMonths.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button
            id="export-pdf"
            onClick={() => onTriggerExport('pdf', reportMonth)}
            className="py-2.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-brand-orange hover:bg-brand-orange-dark transition-all flex items-center justify-center gap-2.5 cursor-pointer group shadow-sm text-white font-semibold shrink-0"
          >
            <Download size={14} className="transition-colors" />
            <span className="text-xs font-medium">Download PDF</span>
          </button>
        </div>
      </div>

      {/* Ad Account Statement */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 max-w-6xl">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ad Account Statement</h3>
        <p className="text-[11px] font-semibold text-slate-500 -mt-3">
          Lists every Ad Account with Sales Entries under the selected Group — including previously unassigned accounts — and generates a statement from its full sales history.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Select Group ID</label>
            <select
              value={statementGroup}
              onChange={handleStatementGroupChange}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer"
            >
              <option value="">All Groups</option>
              {groupOptions.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Select Ad Account</label>
            <select
              value={statementAdAccount}
              onChange={(e) => setStatementAdAccount(e.target.value)}
              disabled={!statementGroup}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">{statementGroup ? 'Select Ad Account' : 'Select a Group first'}</option>
              {adAccountOptions.map(opt => (
                <option key={opt.id || opt.name} value={opt.name}>{opt.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              id="export-ad-account-pdf"
              onClick={() => onDownloadAdAccountStatement(statementGroup, statementAdAccount)}
              disabled={!statementGroup || !statementAdAccount}
              className="w-full py-2.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-brand-orange hover:bg-brand-orange-dark transition-all flex items-center justify-center gap-2.5 cursor-pointer group shadow-sm text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} className="transition-colors" />
              <span className="text-xs font-medium">Download Statement (PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audit Trail & Billing Ledger table with search bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 p-5 max-w-6xl" id="reports-table-card">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Audit Trail &amp; Billing Ledger</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Filtered matching records: {filtered.length} entries</p>
          </div>
          <SearchBar
            maxWidthClass="relative w-full sm:max-w-xs"
            placeholder="Search invoice or account..."
            value={search}
            onChange={(value) => setSearch(value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <th scope="col" className="py-3 pl-4 uppercase tracking-wider text-[10px]">Group Code</th>
                <th scope="col" className="py-3 uppercase tracking-wider text-[10px]">Customer Name</th>
                <th scope="col" className="py-3 uppercase tracking-wider text-[10px]">Ad Account Name</th>
                <th scope="col" className="py-3 text-right uppercase tracking-wider text-[10px]">Topup Amount (USD)</th>
                <th scope="col" className="py-3 text-center uppercase tracking-wider text-[10px]">Platform</th>
                <th scope="col" className="py-3 text-center uppercase tracking-wider text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {paginated.map(inv => {
                const displayGroupCode = inv.groupId || inv.invoiceNo;
                const recordStatus = inv.status || inv.paymentStatus;
                return (
                  <tr key={inv.invoiceNo} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors text-slate-800 dark:text-slate-200">
                    <td className="py-3 pl-4 font-mono font-bold text-slate-900 dark:text-white">{displayGroupCode}</td>
                    <td className="py-3 font-medium text-slate-700 dark:text-slate-300">Customer {inv.customerId || 'Standard'}</td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-white truncate max-w-[180px]" title={inv.adAccountName}>{inv.adAccountName}</td>
                    <td className="py-3 text-right font-bold text-slate-900 dark:text-white">${inv.topupAmountUSD.toLocaleString()}</td>
                    <td className="py-3 text-center"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border shadow-xs"><PlatformText platform={inv.platform} variant="badge" className="font-semibold" /></span></td>
                    <td className="py-3 text-center">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        recordStatus === 'Active' || recordStatus === 'Paid' || recordStatus === 'Available' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60' :
                        recordStatus === 'Need Support' || recordStatus === 'Partially Paid' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60' :
                        'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/60'
                      }`}>
                        {recordStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-medium italic bg-slate-50/50 dark:bg-slate-900/50">
                    No billing ledger records match the selected platform and search term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Showing {filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length} records
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={13} /> Prev
              </button>
              {pageWindow.map((p, idx) =>
                p === '...' ? (
                  <span key={`ellipsis-${idx}`} className="w-7 h-7 flex items-center justify-center text-xs font-bold text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      p === safePage
                        ? 'bg-brand-blue text-white shadow-xs'
                        : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ReportsView);
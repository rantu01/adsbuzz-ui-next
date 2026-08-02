'use client';
import { memo, useEffect, useState } from 'react';
import { BarChart2, ChevronLeft, ChevronRight, TrendingUp, Calendar, Check, CreditCard, Download, DollarSign } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import SearchBar from '@/components/ui/SearchBar';
import Badge from '@/components/ui/Badge';

function ReportsView({ invoices, onTriggerExport }) {
  const [platform, setPlatform] = useState('All');
  const [search, setSearch] = useState('');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const monthFilteredInvoices = invoices.filter(inv => {
    if (!inv.date) return false;
    return inv.date.startsWith(reportMonth);
  });

  // ====== 6 Functions (computed from monthFilteredInvoices) ======
  // 1) TOTAL SELL
  const totalSellUSD = monthFilteredInvoices.reduce((s, inv) => s + (inv.topupAmountUSD || 0), 0);
  const totalSellBDT = monthFilteredInvoices.reduce((s, inv) => s + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // 2) AVERAGE SELL (per invoice)
  const avgSellUSD = monthFilteredInvoices.length > 0 ? totalSellUSD / monthFilteredInvoices.length : 0;
  const avgSellBDT = monthFilteredInvoices.length > 0 ? totalSellBDT / monthFilteredInvoices.length : 0;

  // 3) ADS TOPUP (serviceType === 'Ad Account Topup' OR not Others)
  const adTopupInvoices = monthFilteredInvoices.filter(inv => inv.serviceType !== 'Others');
  const adTopupUSD = adTopupInvoices.reduce((s, inv) => s + (inv.topupAmountUSD || 0), 0);
  const adTopupBDT = adTopupInvoices.reduce((s, inv) => s + (inv.totalAmountBDT || inv.paidAmountBDT || 0), 0);

  // 4) AVG Per $ Sale IN BDT
  const avgPerDollarBDT = totalSellUSD > 0 ? totalSellBDT / totalSellUSD : 0;

  // 5) Payment Approval Status (Total / Approved / Decline)
  const approvalTotalCount = monthFilteredInvoices.length;
  const approvalApprovedCount = monthFilteredInvoices.filter(inv => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved';
    return a === 'Approved';
  }).length;
  const approvalDeclinedCount = monthFilteredInvoices.filter(inv => {
    const a = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved';
    return a === 'Rejected' || a === 'Declined';
  }).length;

  // 6) Payment Status (Paid / Due / Partial Paid)
  const paidCount = monthFilteredInvoices.filter(inv => inv.paymentStatus === 'Paid').length;
  const dueCount = monthFilteredInvoices.filter(inv => inv.paymentStatus === 'Due').length;
  const partialPaidCount = monthFilteredInvoices.filter(inv => inv.paymentStatus === 'Partially Paid').length;

  // 7) Company Summary (BDT)
  const vendorPaymentBDT = monthFilteredInvoices.reduce((s, inv) => s + (inv.paidAmountBDT || 0), 0);
  const officeExpenseBDT = monthFilteredInvoices.length > 0 ? 20810 : 0;
  const refundBDT = 0;
  const totalCompanyBDT = vendorPaymentBDT + officeExpenseBDT + refundBDT;

  // Available months for the selector (current + last 11 months)
  const availableMonths = (() => {
    const set = new Set();
    invoices.forEach(inv => {
      if (inv.date && inv.date.length >= 7) set.add(inv.date.substring(0, 7));
    });
    const cur = new Date().toISOString().substring(0, 7);
    set.add(cur);
    return Array.from(set).sort().reverse();
  })();

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

  const formatUSD = (value) => `USD ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBDT = (value) => `BDT ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const percentOf = (value, total) => total > 0 ? Math.round((value / total) * 100) : 0;

  const statementMetrics = [
    {
      title: 'Total Sell',
      icon: DollarSign,
      background: '#FFF7ED',
      border: '#FBD9B9',
      iconBackground: '#FFE8D4',
      values: [
        { label: 'Total USD', value: formatUSD(totalSellUSD) },
        { label: 'Total BDT', value: formatBDT(totalSellBDT) },
      ],
    },
    {
      title: 'Average Sell',
      icon: TrendingUp,
      background: '#F0F7FF',
      border: '#CFE1F5',
      iconBackground: '#DCEBFA',
      values: [
        { label: 'Amount USD', value: formatUSD(avgSellUSD) },
        { label: 'Amount BDT', value: formatBDT(avgSellBDT) },
      ],
    },
    {
      title: 'Ads Topup',
      icon: BarChart2,
      background: '#F1FBF5',
      border: '#CFEBDD',
      iconBackground: '#DAF5E5',
      values: [
        { label: 'Topup USD', value: formatUSD(adTopupUSD) },
        { label: 'Topup BDT', value: formatBDT(adTopupBDT) },
      ],
    },
    {
      title: 'Avg Per USD Sale',
      icon: CreditCard,
      background: '#FFFBEA',
      border: '#F6E7A8',
      iconBackground: '#FEF3C7',
      values: [
        { label: 'BDT Rate', value: formatBDT(avgPerDollarBDT) },
      ],
    },
  ];

  const approvalRows = [
    { label: 'Total Requests', count: approvalTotalCount, background: '#F4F8FC', border: '#D8E6F3', bar: '#BFD7EA' },
    { label: 'Approved', count: approvalApprovedCount, background: '#F1FBF5', border: '#CFEBDD', bar: '#A7E5C0' },
    { label: 'Declined', count: approvalDeclinedCount, background: '#FFF1F2', border: '#F8D6DC', bar: '#F8B4BE' },
  ];

  const paymentRows = [
    { label: 'Paid', count: paidCount, background: '#F1FBF5', border: '#CFEBDD', bar: '#A7E5C0' },
    { label: 'Due', count: dueCount, background: '#FFF7ED', border: '#FBD9B9', bar: '#FDBA74' },
    { label: 'Partial Paid', count: partialPaidCount, background: '#F0F7FF', border: '#CFE1F5', bar: '#B9D7F0' },
  ];

  const companyRows = [
    { label: 'Office Expense', value: officeExpenseBDT },
    { label: 'Vendor Payment', value: vendorPaymentBDT },
    { label: 'Refund', value: refundBDT },
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
                <h3 className="text-sm font-bold text-slate-900">Payment Approval Status</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Approval flow for selected month</p>
              </div>
              <Check size={17} strokeWidth={1.8} className="text-slate-600" />
            </div>

            <div className="mt-4 space-y-2.5">
              {approvalRows.map(row => {
                const progress = percentOf(row.count, Math.max(approvalTotalCount, 1));
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
                <h3 className="text-sm font-bold text-slate-900">Payment Status</h3>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Collection state across invoices</p>
              </div>
              <CreditCard size={17} strokeWidth={1.8} className="text-slate-600" />
            </div>

            <div className="mt-4 space-y-2.5">
              {paymentRows.map(row => {
                const progress = percentOf(row.count, Math.max(approvalTotalCount, 1));
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
        </div>

        <div className="rounded-2xl border border-border-blue-light bg-surface p-4 shadow-[0_12px_30px_rgba(12,66,117,0.06)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Company Summary</h3>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">Expense and vendor ledger in BDT</p>
            </div>
            <span className="w-fit rounded-full border border-border-orange bg-surface-orange px-3 py-1 text-[11px] font-bold text-[#9a4a05]">
              Total {formatBDT(totalCompanyBDT)}
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border-blue-light bg-white/75">
            {companyRows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-4 border-b border-border-blue-light px-3 py-3 last:border-b-0">
                <span className="text-xs font-semibold text-slate-700">{row.label}</span>
                <span className="text-right text-xs font-extrabold text-slate-900">{formatBDT(row.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 bg-surface-blue px-3 py-3 border-t border-border-blue-light">
              <span className="text-xs font-extrabold text-brand-blue-deep">Total</span>
              <span className="text-right text-sm font-black text-brand-blue-deep">{formatBDT(totalCompanyBDT)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 max-w-6xl">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cross-Reference Filter Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Publisher Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange"
            >
              <option value="All">All Social Networks</option>
              <option value="Facebook">Facebook Ads</option>
              <option value="TikTok">TikTok Ads</option>
              <option value="Google">Google MCC</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Audit Fiscal Date Range</label>
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
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">Gateway Channel</label>
            <select className="w-full text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-brand-orange">
              <option>All Bank &amp; Mobile Wallets</option>
              <option>Eastern Bank Ltd (EBL)</option>
              <option>bKash reselling channel</option>
            </select>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Handoff Document Exports</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              id="export-pdf"
              onClick={() => onTriggerExport('pdf')}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between cursor-pointer group shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-2.5">
                <Badge tone="danger" style="box" className="uppercase">PDF</Badge>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Download Statements</span>
              </div>
              <Download size={14} className="text-slate-400 group-hover:text-brand-orange transition-colors" />
            </button>

            <button
              id="export-excel"
              onClick={() => onTriggerExport('excel')}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between cursor-pointer group shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-2.5">
                <Badge tone="success" style="box" className="uppercase">XLS</Badge>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Excel Spreadsheet</span>
              </div>
              <Download size={14} className="text-slate-400 group-hover:text-brand-orange transition-colors" />
            </button>

            <button
              id="export-csv"
              onClick={() => onTriggerExport('csv')}
              className="py-2.5 px-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center justify-between cursor-pointer group shadow-sm hover:border-slate-300 dark:hover:border-slate-700"
            >
              <div className="flex items-center gap-2.5">
                <Badge tone="info" style="box" className="uppercase">CSV</Badge>
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Comma-Separated</span>
              </div>
              <Download size={14} className="text-slate-400 group-hover:text-brand-orange transition-colors" />
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
            onChange={(e) => setSearch(e.target.value)}
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
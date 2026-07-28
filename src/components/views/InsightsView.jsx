'use client';
import { memo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react';
import PlatformText from '@/components/common/PlatformText';
import StatCard from '@/components/common/StatCard';
import SearchBar from '@/components/ui/SearchBar';

const EARLY_INSIGHTS_DATA = [
  { month: 'Mar 24', bdt: 851430, mom: 0 },
  { month: 'Apr 24', bdt: 222666, mom: -73.85 },
  { month: 'May 24', bdt: 1131460, mom: 408.14 },
  { month: 'Jun 24', bdt: 1528912, mom: 35.13 },
  { month: 'Jul 24', bdt: 996232, mom: -34.84 },
  { month: 'Aug 24', bdt: 1136887, mom: 14.12 },
  { month: 'Sep 24', bdt: 1526419, mom: 34.26 },
  { month: 'Oct 24', bdt: 2963613, mom: 94.15 },
  { month: 'Nov 24', bdt: 3819296, mom: 28.87 },
  { month: 'Dec 24', bdt: 4620021, mom: 20.97 },
  { month: 'Jan 25', bdt: 4110249, mom: -11.03 },
  { month: 'Feb 25', bdt: 4664986, mom: 13.50 },
  { month: 'Mar 25', bdt: 4300996, mom: -7.80 },
  { month: 'Apr 25', bdt: 2731675, mom: -36.49 },
  { month: 'May 25', bdt: 4446609, mom: 62.78 },
  { month: 'Jun 25', bdt: 3309789, mom: -25.57 },
  { month: 'Jul 25', bdt: 5384842, mom: 62.69 },
  { month: 'Aug 25', bdt: 6201438, mom: 15.16 },
  { month: 'Sep 25', bdt: 6789894, mom: 9.49 },
  { month: 'Oct 25', bdt: 7949159, mom: 17.07 },
  { month: 'Nov 25', bdt: 8799451, mom: 10.70 },
  { month: 'Dec 25', bdt: 10850654, mom: 23.31 },
  { month: 'Jan 26', bdt: 11262245, mom: 3.79 },
  { month: 'Feb 26', bdt: 10679016, mom: -5.18 },
  { month: 'Mar 26', bdt: 12434646, mom: 16.44 },
  { month: 'Apr 26', bdt: 12498062, mom: 0.51 },
  { month: 'May 26', bdt: 12209357, mom: -2.31 }
];

function InsightsView({ invoices, adAccounts, vendors, cards = [], series = [], selectedAccId, onSelectAccId }) {
  // Top level filters
  const [selectedVendorFilter, setSelectedVendorFilter] = useState('All Vendors');
  const [selectedSeriesFilter, setSelectedSeriesFilter] = useState('All Series');
  const [selectedCardFilter, setSelectedCardFilter] = useState('All Cards');

  // Invoices used by Channel & Daily Analytics tables (respects top-level filters)
  const filteredInsightsInvoices = invoices.filter(inv => {
    // Vendor filter (matches the invoice's customerId against selected vendor's name/id if any)
    if (selectedVendorFilter !== 'All Vendors') {
      const v = vendors.find(vd => vd.id === selectedVendorFilter || vd.name === selectedVendorFilter);
      if (v && inv.customerId && inv.customerId !== v.id) return false;
    }
    // Card filter — match by paymentMethod against cardName (or fallback: skip if no match)
    if (selectedCardFilter !== 'All Cards') {
      const c = cards.find(cd => cd.id === selectedCardFilter || cd.cardName === selectedCardFilter);
      if (c && c.cardName && inv.paymentMethod !== c.cardName) return false;
    }
    // Series filter — invoices don't carry seriesId, so leave it unfiltered (no-op for invoices)
    return true;
  });

  // Aggregate sales by Platform for the Recharts Pie
  const platformSpend = invoices.reduce((acc, inv) => {
    if (inv.paymentStatus === 'Paid') {
      acc[inv.platform] = (acc[inv.platform] || 0) + inv.topupAmountUSD;
    }
    return acc;
  }, {});

  const dataPie = Object.keys(platformSpend).map(key => ({
    name: key,
    value: Math.round(platformSpend[key])
  }));

  const GATEWAY_DATA = [
    { name: 'EBL Bank EBL - 1342', value: 17604635 },
    { name: 'bKash Wallet Channel', value: 1304617 },
    { name: 'Nagad Wallet Channel', value: 436912 },
    { name: 'Celfin Online Sync', value: 862531 }
  ];

  const COLOR_PALETTE = ['#1F5E98', '#FE2C55', '#4285F4', '#FFFC00', '#F68B2D', '#10B981'];

  // State for Ad Account Analyzer
  const [accountSearch, setAccountSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [localSelectedAccId, setLocalSelectedAccId] = useState(adAccounts[0]?.adAccountId || '');

  // State for Early Stage Growth Analyzer
  const [earlySearch, setEarlySearch] = useState('');
  const [earlyFilter, setEarlyFilter] = useState('all');

  const activeSelectedAccId = selectedAccId !== undefined && selectedAccId !== '' ? selectedAccId : localSelectedAccId;
  const setActiveSelectedAccId = onSelectAccId || setLocalSelectedAccId;

  // Filter accounts
  const filteredAccounts = adAccounts.filter(acc => {
    const matchesPlatform = platformFilter === 'All' ? true : acc.platform === platformFilter;
    const matchesSearch = acc.adAccountName.toLowerCase().includes(accountSearch.toLowerCase()) ||
                          acc.adAccountId.toLowerCase().includes(accountSearch.toLowerCase());
    return matchesPlatform && matchesSearch;
  });

  // Active selected account fallback
  const activeAcc = adAccounts.find(a => a.adAccountId === activeSelectedAccId) || filteredAccounts[0] || adAccounts[0];

  // Calculate stats for the selected account
  const matchingInvoices = activeAcc ? invoices.filter(inv =>
    (inv.adAccountId && inv.adAccountId === activeAcc.adAccountId) ||
    (inv.adAccountName && inv.adAccountName.toLowerCase() === activeAcc.adAccountName.toLowerCase())
  ) : [];

  const totalUSD = matchingInvoices.reduce((sum, inv) => sum + inv.topupAmountUSD, 0);
  const totalBDT = matchingInvoices.reduce((sum, inv) => sum + inv.totalAmountBDT, 0);
  const averageRate = totalUSD > 0 ? (totalBDT / totalUSD) : (activeAcc?.dollarRate || 130);

  // Overall KPI Card calculations based on filters
  const overallTopupUSD = invoices.reduce((sum, inv) => sum + inv.topupAmountUSD, 0);
  const overallInvestmentUSD = Math.round(overallTopupUSD * 0.92);
  const marginBalanceUSD = overallTopupUSD - overallInvestmentUSD;
  const marginPercentage = overallTopupUSD > 0 ? ((marginBalanceUSD / overallTopupUSD) * 100).toFixed(1) + '%' : '0.0%';

  return (
    <div className="space-y-8 animate-fade-in" id="insights-view">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Business Intelligence</h1>
        <p className="text-sm text-slate-500">Live analytical breakdown of topup revenues, gateway receipts, and wholesalers.</p>
      </div>

      {/* Top Filter Dropdowns */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Select Vendor</label>
          <select
            value={selectedVendorFilter}
            onChange={(e) => setSelectedVendorFilter(e.target.value)}
            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-medium"
          >
            <option value="All Vendors">All Vendors</option>
            {vendors.map(v => (
              <option key={v.id} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Select Series</label>
          <select
            value={selectedSeriesFilter}
            onChange={(e) => setSelectedSeriesFilter(e.target.value)}
            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-medium"
          >
            <option value="All Series">All Series</option>
            {series.map(s => (
              <option key={s.seriesId} value={s.seriesName}>{s.seriesName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1.5">Select Card</label>
          <select
            value={selectedCardFilter}
            onChange={(e) => setSelectedCardFilter(e.target.value)}
            className="w-full text-xs p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white font-medium"
          >
            <option value="All Cards">All Cards</option>
            {cards.map(c => (
              <option key={c.id} value={c.cardName}>{c.cardName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 4 KPI Metric Cards in a Single Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Investment (USD) - Soft Peach */}
        <div className="p-5 rounded-2xl border border-border-orange bg-surface-orange shadow-sm space-y-1">
          <p className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider">Total Investment (USD)</p>
          <p className="text-2xl font-black text-brand-blue-deep">${overallInvestmentUSD.toLocaleString()}</p>
          <p className="text-[10px] text-brand-blue-deep/70 font-medium">Capital deployed across inventory</p>
        </div>

        {/* Total Topup (USD) - Soft Light Blue */}
        <div className="p-5 rounded-2xl border border-border-blue bg-surface-blue shadow-sm space-y-1">
          <p className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider">Total Topup (USD)</p>
          <p className="text-2xl font-black text-brand-blue-deep">${overallTopupUSD.toLocaleString()}</p>
          <p className="text-[10px] text-brand-blue-deep/70 font-medium">Gross processed top-up sales</p>
        </div>

        {/* Available Margin Balance (USD) - Soft Mint Green */}
        <div className="p-5 rounded-2xl border border-border-green bg-surface-green shadow-sm space-y-1">
          <p className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider">Available Margin Balance (USD)</p>
          <p className="text-2xl font-black text-brand-blue-deep">${marginBalanceUSD.toLocaleString()}</p>
          <p className="text-[10px] text-brand-blue-deep/70 font-medium">Net positive balance</p>
        </div>

        {/* Margin (%) - Soft Gold/Yellow */}
        <div className="p-5 rounded-2xl border border-border-yellow bg-surface-yellow shadow-sm space-y-1">
          <p className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider">Margin (%)</p>
          <p className="text-2xl font-black text-brand-blue-deep">{marginPercentage}</p>
          <p className="text-[10px] text-brand-blue-deep/70 font-medium">Profit yield ratio</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Platform Share */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Cumulative Publisher Revenue Share</h3>
            <p className="text-xs text-slate-400">Total top-ups approved this fiscal period ($ USD).</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {dataPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => `$${v}`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Gateway Breakdown */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Income Gateway Distribution (BDT)</h3>
            <p className="text-xs text-slate-400">Comparing payment channels by transaction volume values.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={GATEWAY_DATA} margin={{ left: -10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={9} tickLine={false} />
                <YAxis fontSize={9} tickLine={false} />
                <Tooltip
                  formatter={(v) => `৳${Number(v).toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: '12px', fontWeight: 'bold', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                  labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#F68B2D" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Early Stage Growth & BDT Sales Momentum (Early Insights) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6" id="early-stage-growth-analyzer">
        <div className="border-b border-slate-150 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="text-brand-orange h-5 w-5" />
              Early Stage Revenue &amp; Chronological MoM Growth
            </h3>
            <p className="text-xs text-slate-500 mt-1">Detailed analysis of sales volume trends and Month-on-Month (MoM) growth rates representing early business performance metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-brand-orange/10 text-brand-orange px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
              Early Insights Active
            </span>
          </div>
        </div>

        {/* 3 Executive Stat Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="CUMULATIVE BDT VOLUME"
            value={`৳${EARLY_INSIGHTS_DATA.reduce((sum, item) => sum + item.bdt, 0).toLocaleString()}`}
            variant="amber"
            subtext="Consolidated early sales ledger"
          />

          <StatCard
            title="AVG MOM GROWTH"
            value={`+${(EARLY_INSIGHTS_DATA.filter(i => i.mom !== 0).reduce((sum, i) => sum + i.mom, 0) / EARLY_INSIGHTS_DATA.filter(i => i.mom !== 0).length).toFixed(2)}%`}
            variant="emerald"
            subtext="Average positive sales vector"
          />

          <StatCard
            title="PEAK MONTH SALES"
            value={`৳${Math.max(...EARLY_INSIGHTS_DATA.map(i => i.bdt)).toLocaleString()}`}
            variant="blue"
            subtext={`Achieved in ${EARLY_INSIGHTS_DATA.find(i => i.bdt === Math.max(...EARLY_INSIGHTS_DATA.map(i => i.bdt)))?.month || 'N/A'}`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left / Center Column: Area Chart */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black text-black dark:text-white uppercase tracking-wide">
                Sell BDT vs. Months Trendline
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 bg-brand-orange rounded-full inline-block"></span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-black">Sell BDT (৳)</span>
              </div>
            </div>

            <div className="h-80 w-full bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={EARLY_INSIGHTS_DATA} margin={{ top: 15, right: 10, left: 15, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorBdt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F68B2D" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F68B2D" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="month"
                    stroke="#94A3B8"
                    fontSize={10}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontWeight: 'bold' }}
                  />
                  <YAxis
                    stroke="#94A3B8"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#64748B', fontWeight: 'bold' }}
                    tickFormatter={(val) => `৳${(val / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    formatter={(val) => [`৳${Number(val).toLocaleString()}`, 'Sales Volume']}
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      color: '#000000',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    labelStyle={{ color: '#000000', fontWeight: '950' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bdt"
                    stroke="#F68B2D"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorBdt)"
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#F68B2D' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right Column: Interactive Searchable MoM Ledger */}
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-black text-black dark:text-white uppercase tracking-wide block">
                Growth (MoM) Ledger
              </span>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'positive', 'negative']).map((filterVal) => {
                  let buttonStyle = '';
                  if (filterVal === 'positive') {
                    buttonStyle = earlyFilter === 'positive'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold ring-1 ring-emerald-600'
                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold';
                  } else if (filterVal === 'negative') {
                    buttonStyle = earlyFilter === 'negative'
                      ? 'bg-rose-600 text-white shadow-sm font-bold ring-1 ring-rose-600'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold';
                  } else {
                    buttonStyle = earlyFilter === 'all'
                      ? 'bg-slate-200 dark:bg-slate-100 text-black dark:text-slate-900 border border-slate-400 dark:border-slate-300 shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-black dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 font-semibold';
                  }

                  return (
                    <button
                      key={filterVal}
                      onClick={() => setEarlyFilter(filterVal)}
                      className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer ${buttonStyle}`}
                    >
                      {filterVal === 'all' ? 'All' : filterVal === 'positive' ? 'Positives (+)' : 'Negatives (-)'}
                    </button>
                  );
                })}
              </div>

              {/* Search Month Input */}
              <SearchBar
                showIcon={false}
                placeholder="Search month (e.g. Apr 25)..."
                value={earlySearch}
                onChange={(e) => setEarlySearch(e.target.value)}
                className="!pl-8 !pr-3 font-bold text-black dark:text-white"
              />
            </div>

            {/* Scrollable list of months with positive/negative coloring matching the Sheets layout */}
            <div className="max-h-[250px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50">
              {EARLY_INSIGHTS_DATA.filter(item => {
                const matchesSearch = item.month.toLowerCase().includes(earlySearch.toLowerCase());
                const matchesFilter = earlyFilter === 'all'
                  ? true
                  : earlyFilter === 'positive'
                    ? item.mom > 0
                    : item.mom < 0;
                return matchesSearch && matchesFilter;
              }).length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 italic">No matching growth data found</div>
              ) : (
                EARLY_INSIGHTS_DATA.filter(item => {
                  const matchesSearch = item.month.toLowerCase().includes(earlySearch.toLowerCase());
                  const matchesFilter = earlyFilter === 'all'
                    ? true
                    : earlyFilter === 'positive'
                      ? item.mom > 0
                      : item.mom < 0;
                  return matchesSearch && matchesFilter;
                }).map((item) => {
                  const isPositive = item.mom > 0;
                  const isNegative = item.mom < 0;
                  const isZero = item.mom === 0;

                  return (
                    <div
                      key={item.month}
                      className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="text-slate-400 h-4 w-4" />
                        <span className="text-xs font-black text-slate-900 dark:text-white">{item.month}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-mono">
                          ৳{item.bdt.toLocaleString()}
                        </span>

                        {/* MoM % Growth Badges matching the Google Sheets exact values & styles */}
                        <span className={`w-20 text-center px-2.5 py-1 rounded-lg text-[10px] font-black flex items-center justify-center gap-1 border ${
                          isPositive
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : isNegative
                              ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}>
                          {isPositive && <ArrowUpRight className="h-3 w-3 shrink-0" />}
                          {isNegative && <ArrowDownRight className="h-3 w-3 shrink-0" />}
                          {isZero ? '0.00%' : `${isPositive ? '+' : ''}${item.mom.toFixed(2)}%`}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Channel & Daily Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start" id="channel-analytics-panel">
        {/* Channel Wise Payment Received */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden ring-1 ring-slate-900/[0.02]">
          <div className="card-header-title bg-surface-orange text-brand-blue-deep border-b border-border-orange px-4 py-2.5 text-center font-extrabold text-xs uppercase tracking-wider">
            <span>Channel Wise Payment Received</span>
            <span className="text-[10px] font-bold opacity-80 normal-case tracking-normal">All transactions</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">QTY</th>
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(() => {
                const map = new Map();
                filteredInsightsInvoices.forEach(inv => {
                  const key = inv.paymentMethod || 'Unknown';
                  const cur = map.get(key) || { qty: 0, amount: 0 };
                  cur.qty += 1;
                  cur.amount += inv.totalAmountBDT || inv.paidAmountBDT || 0;
                  map.set(key, cur);
                });
                const rows = Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
                const totalQty = rows.reduce((s, r) => s + r[1].qty, 0);
                const totalAmt = rows.reduce((s, r) => s + r[1].amount, 0);
                if (rows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400 italic">No channel data</td>
                    </tr>
                  );
                }
                return (
                  <>
                    {rows.map(([name, v], idx) => (
                      <tr key={name} className="group hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-transparent dark:hover:from-blue-950/20 dark:hover:to-transparent transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${idx === 0 ? 'bg-brand-orange' : idx === 1 ? 'bg-brand-blue' : 'bg-slate-300'}`} />
                            {name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                          <span className="insight-qty-chip inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-md text-[11px] font-black">
                            {v.qty}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-900 dark:text-white font-black tabular-nums tracking-tight">
                          ৳{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-brand-orange/10 to-transparent border-t-2 border-brand-orange/30">
                      <td className="px-4 py-3 text-xs font-black text-brand-orange uppercase tracking-wider">Total</td>
                      <td className="px-4 py-3 text-xs text-right font-black text-brand-orange tabular-nums">{totalQty}</td>
                      <td className="px-4 py-3 text-xs text-right font-black text-brand-orange tabular-nums tracking-tight">৳{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Total Sale + Daily Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden ring-1 ring-slate-900/[0.02]">
          <div className="card-header-title bg-surface-blue text-brand-blue-deep border-b border-border-blue px-4 py-2.5 text-center font-extrabold text-xs uppercase tracking-wider">
            <span>Total Sale (Daily Breakdown)</span>
            <span className="text-[10px] font-bold opacity-80 normal-case tracking-normal">By date</span>
          </div>
          {(() => {
            const dailyMap = new Map();
            filteredInsightsInvoices.forEach(inv => {
              if (!inv.date) return;
              const key = inv.date;
              const cur = dailyMap.get(key) || { usd: 0, bdt: 0 };
              cur.usd += inv.topupAmountUSD || 0;
              cur.bdt += inv.totalAmountBDT || inv.paidAmountBDT || 0;
              dailyMap.set(key, cur);
            });
            const dayRows = Array.from(dailyMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));
            const totalUSD = dayRows.reduce((s, r) => s + r[1].usd, 0);
            const totalBDT = dayRows.reduce((s, r) => s + r[1].bdt, 0);
            return (
              <div className="max-h-[368px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th colSpan={3} className="px-4 py-4 text-center bg-gradient-to-br from-brand-orange/8 via-surface-orange to-surface-blue-light border-b border-slate-200/70 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] uppercase tracking-[0.14em]">
                          <span className="text-slate-500 font-bold">Total Sale</span>
                          <span className="text-brand-orange font-black text-base tabular-nums tracking-tight">${totalUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-brand-blue-deep font-black text-base tabular-nums tracking-tight">৳{totalBDT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </th>
                    </tr>
                    <tr className="text-left bg-white dark:bg-slate-900">
                      <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Total Amount USD</th>
                      <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Total Amount BDT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dayRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400 italic">No daily data</td>
                    </tr>
                  ) : (
                    dayRows.map(([date, v], idx) => (
                      <tr key={date} className="hover:bg-gradient-to-r hover:from-orange-50/40 hover:to-transparent dark:hover:from-orange-950/20 dark:hover:to-transparent transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-700 dark:text-slate-200 font-mono font-semibold tabular-nums">
                          <span className="inline-flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 w-6 tabular-nums">#{idx + 1}</span>
                            {date}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-900 dark:text-white font-black tabular-nums tracking-tight">${v.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-900 dark:text-white font-black tabular-nums tracking-tight">৳{v.bdt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            );
          })()}
        </div>

        {/* Channel Wise Vendor Payment (Paid) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden ring-1 ring-slate-900/[0.02]">
          <div className="card-header-title bg-surface-green text-brand-blue-deep border-b border-border-green px-4 py-2.5 text-center font-extrabold text-xs uppercase tracking-wider">
            <span>Channel Wise Vendor Payment (Paid)</span>
            <span className="text-[10px] font-bold opacity-80 normal-case tracking-normal">Settled only</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">QTY</th>
                <th scope="col" className="px-4 py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {(() => {
                const map = new Map();
                filteredInsightsInvoices.filter(inv => inv.paymentStatus === 'Paid').forEach(inv => {
                  const key = inv.paymentMethod || 'Unknown';
                  const cur = map.get(key) || { qty: 0, amount: 0 };
                  cur.qty += 1;
                  cur.amount += inv.paidAmountBDT || inv.totalAmountBDT || 0;
                  map.set(key, cur);
                });
                const rows = Array.from(map.entries()).sort((a, b) => b[1].amount - a[1].amount);
                const totalQty = rows.reduce((s, r) => s + r[1].qty, 0);
                const totalAmt = rows.reduce((s, r) => s + r[1].amount, 0);
                if (rows.length === 0) {
                  return (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-xs text-slate-400 italic">No vendor payment data</td>
                    </tr>
                  );
                }
                return (
                  <>
                    {rows.map(([name, v], idx) => (
                      <tr key={name} className="group hover:bg-gradient-to-r hover:from-emerald-50/60 hover:to-transparent dark:hover:from-emerald-950/20 dark:hover:to-transparent transition-colors">
                        <td className="px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${idx === 0 ? 'bg-status-green-deep' : idx === 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                            {name}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                          <span className="insight-paid-qty-chip inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded-md text-[11px] font-black">
                            {v.qty}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-slate-900 dark:text-white font-black tabular-nums tracking-tight">৳{v.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr className="bg-gradient-to-r from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent border-t-2 border-emerald-200/60 dark:border-emerald-800/40">
                      <td className="px-4 py-3 text-xs font-black text-status-green-deep uppercase tracking-wider">Total Paid</td>
                      <td className="px-4 py-3 text-xs text-right font-black text-status-green-deep tabular-nums">{totalQty}</td>
                      <td className="px-4 py-3 text-xs text-right font-black text-status-green-deep tabular-nums tracking-tight">৳{totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  </>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* Payment Approval Status + Payment Status */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden ring-1 ring-slate-900/[0.02]">
          <div className="card-header-title bg-surface-yellow text-brand-blue-deep border-b border-border-yellow px-4 py-2.5 text-center font-extrabold text-xs uppercase tracking-wider">
            <span>Approval &amp; Payment Status</span>
            <span className="text-[10px] font-bold opacity-80 normal-case tracking-normal">Aggregated</span>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Approval Status</span>
                <span className="text-[10px] font-bold text-slate-400">{filteredInsightsInvoices.length} total</span>
              </div>
              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                {[
                  { label: 'Approved', count: filteredInsightsInvoices.filter(inv => (inv.approvalStatus || inv.paymentVerificationStatus || 'Approved') === 'Approved').length, tone: 'emerald', dot: '#10b981' },
                  { label: 'Declined', count: filteredInsightsInvoices.filter(inv => { const a = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved'; return a === 'Rejected' || a === 'Declined'; }).length, tone: 'rose', dot: '#f43f5e' },
                  { label: 'Pending', count: filteredInsightsInvoices.filter(inv => { const a = inv.approvalStatus || inv.paymentVerificationStatus || 'Approved'; return a === 'Pending'; }).length, tone: 'amber', dot: '#f59e0b' },
                ].map((row, idx) => {
                  const total = filteredInsightsInvoices.length || 1;
                  const pct = Math.round((row.count / total) * 100);
                  return (
                    <div key={row.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${idx === 0 ? '' : 'border-t border-slate-100 dark:border-slate-800'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.dot }} />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md insight-status-chip-${row.tone === 'emerald' ? 'paid' : row.tone === 'rose' ? 'rose' : 'amber'}`}>{row.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.dot }} />
                        </div>
                        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white min-w-[2.5rem] text-right">{row.count.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Status</span>
                <span className="text-[10px] font-bold text-slate-400">{filteredInsightsInvoices.length} total</span>
              </div>
              <div className="rounded-xl border border-slate-200/70 dark:border-slate-800 overflow-hidden">
                {[
                  { label: 'Paid', count: filteredInsightsInvoices.filter(inv => inv.paymentStatus === 'Paid').length, dot: '#0a5c3a', chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' },
                  { label: 'Partially Paid', count: filteredInsightsInvoices.filter(inv => inv.paymentStatus === 'Partially Paid').length, dot: '#f59e0b', chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
                  { label: 'Due', count: filteredInsightsInvoices.filter(inv => inv.paymentStatus === 'Due').length, dot: '#dc2626', chip: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' },
                ].map((row, idx) => {
                  const total = filteredInsightsInvoices.length || 1;
                  const pct = Math.round((row.count / total) * 100);
                  return (
                    <div key={row.label} className={`flex items-center justify-between gap-3 px-4 py-3 ${idx === 0 ? '' : 'border-t border-slate-100 dark:border-slate-800'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.dot }} />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md insight-status-chip-${row.label === 'Paid' ? 'paid' : row.label === 'Partially Paid' ? 'amber' : 'rose'}`}>{row.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.dot }} />
                        </div>
                        <span className="text-sm font-black tabular-nums text-slate-900 dark:text-white min-w-[2.5rem] text-right">{row.count.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ad Account Intelligence Hub */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6" id="ad-account-intelligence-hub">
        <div className="border-b border-slate-150 dark:border-slate-800 pb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-white">Ad Account Performance &amp; History Analyzer</h3>
          <p className="text-xs text-slate-500 mt-1">Select any ad account below to immediately view total dollar loaded, BDT invoices, and a live top-up trail ledger.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left Column: Selector & Search Sidebar */}
          <div className="space-y-4 lg:col-span-1">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter Publisher Platform</label>
              <div className="flex flex-wrap gap-1">
                {(['All', 'Facebook', 'TikTok', 'Google', 'Snapchat']).map((plat) => {
                  let activeClasses = 'bg-brand-blue text-white shadow-sm';
                  if (plat === 'Facebook') {
                    activeClasses = 'bg-[#1877F2] text-white shadow-sm';
                  } else if (plat === 'TikTok') {
                    activeClasses = 'bg-[#FE2C55] text-white shadow-sm';
                  } else if (plat === 'Google') {
                    activeClasses = 'bg-[#22C55E] text-white shadow-sm';
                  } else if (plat === 'Snapchat') {
                    activeClasses = 'bg-[#FACC15] text-slate-950 shadow-sm';
                  } else if (plat === 'All') {
                    activeClasses = 'bg-brand-orange text-white shadow-sm';
                  }

                  return (
                    <button
                      key={plat}
                      onClick={() => setPlatformFilter(plat)}
                      className={`px-2.5 py-1 text-[9px] uppercase font-black rounded-lg transition-all cursor-pointer ${
                        platformFilter === plat
                          ? activeClasses
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {plat}
                    </button>
                  );
                })}
              </div>
            </div>

            <SearchBar
              placeholder="Search ad account name or ID..."
              value={accountSearch}
              onChange={(e) => setAccountSearch(e.target.value)}
              className="!py-2.5 font-bold text-black dark:text-white"
            />

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Accounts ({filteredAccounts.length})
              </span>
              <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl">
                {filteredAccounts.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 italic">No matching accounts found</div>
                ) : (
                  filteredAccounts.map((acc) => {
                    const isActive = activeAcc?.adAccountId === acc.adAccountId;
                    const accountInvs = invoices.filter(inv =>
                      (inv.adAccountId && inv.adAccountId === acc.adAccountId) ||
                      (inv.adAccountName && inv.adAccountName.toLowerCase() === acc.adAccountName.toLowerCase())
                    );
                    const totalAccUSD = accountInvs.reduce((s, i) => s + i.topupAmountUSD, 0);

                    return (
                      <button
                        key={acc.adAccountId}
                        onClick={() => setActiveSelectedAccId(acc.adAccountId)}
                        style={{ borderLeft: isActive ? '5px solid #154A7D' : '5px solid transparent' }}
                        className={`w-full text-left p-3 flex flex-col gap-1 transition-all cursor-pointer ${
                          isActive
                            ? 'font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2 w-full">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[160px]">{acc.adAccountName}</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${
                            acc.platform === 'Facebook' ? 'bg-[#E7F0FE] text-[#1877F2] border border-[#1877F2]/25' :
                            acc.platform === 'TikTok' ? 'bg-gradient-to-r from-[#E6FFFB] to-[#FFE7EC] text-[#FE2C55] border border-[#FE2C55]/25' :
                            acc.platform === 'Google' ? 'bg-gradient-to-r from-[#E6F4EA] via-[#FEF7E0] to-[#E8F0FE] text-[#1A73E8] border border-[#1A73E8]/25' :
                            'bg-amber-100 dark:bg-amber-900/30'
                          }`}>
                            <PlatformText platform={acc.platform} />
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                          <span className="font-mono text-[9px] text-slate-400 truncate max-w-[110px]">{acc.adAccountId}</span>
                          <span className="font-black text-brand-orange">${totalAccUSD.toLocaleString()} loaded</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Calculations & Complete Chronological Ledger History */}
          <div className="lg:col-span-2 space-y-6">
            {activeAcc ? (
              <div className="space-y-6">

                {/* Account Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-900 dark:text-white">{activeAcc.adAccountName}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        activeAcc.platform === 'Facebook' ? 'bg-[#E7F0FE] text-[#1877F2] border border-[#1877F2]/25' :
                        activeAcc.platform === 'TikTok' ? 'bg-gradient-to-r from-[#E6FFFB] to-[#FFE7EC] text-[#FE2C55] border border-[#FE2C55]/25' :
                        activeAcc.platform === 'Google' ? 'bg-gradient-to-r from-[#E6F4EA] via-[#FEF7E0] to-[#E8F0FE] text-[#1A73E8] border border-[#1A73E8]/25' :
                        'bg-amber-100 text-amber-900'
                      }`}>
                        <PlatformText platform={activeAcc.platform} />
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-slate-800 dark:text-slate-200">ID: {activeAcc.adAccountId}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-700 dark:text-slate-300">BM: {activeAcc.bmName || "N/A"}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-700 dark:text-slate-300">Card: {activeAcc.billingCard || "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
                      activeAcc.accountStatus === 'Active' || activeAcc.accountStatus === 'Available'
                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                        : 'bg-rose-100 text-rose-950 border-rose-300'
                    }`}>
                      {activeAcc.accountStatus}
                    </span>
                  </div>
                </div>

                {/* Stat Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-border-orange bg-surface-orange shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider block">Total USD Top-up</span>
                    <h4 className="text-xl font-black text-brand-blue-deep">${totalUSD.toLocaleString()}</h4>
                    <span className="text-[9px] text-brand-blue-deep/70 font-medium block">Cumulative loaded sum</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-border-blue bg-surface-blue shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider block">Total BDT Spent</span>
                    <h4 className="text-xl font-black text-brand-blue-deep">৳{totalBDT.toLocaleString()}</h4>
                    <span className="text-[9px] text-brand-blue-deep/70 font-medium block">Cumulative local spent</span>
                  </div>

                  <div className="p-4 rounded-2xl border border-border-green bg-surface-green shadow-sm space-y-1">
                    <span className="text-[10px] font-bold text-brand-blue-deep/80 uppercase tracking-wider block">Avg Exchange Rate</span>
                    <h4 className="text-xl font-black text-brand-blue-deep">৳{averageRate.toFixed(2)}</h4>
                    <span className="text-[9px] text-brand-blue-deep/70 font-medium block">Weighted BDT per USD</span>
                  </div>
                </div>

                {/* Chronological Invoice Ledger */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Chronological Top-Up Ledger</h4>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md tabular-nums shadow-sm insight-entries-badge">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      {matchingInvoices.length} entries
                    </span>
                  </div>
                  <div className="overflow-hidden border border-slate-200/70 dark:border-slate-800 rounded-2xl ring-1 ring-slate-900/[0.02]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/60 dark:to-slate-800/30">
                          <th scope="col" className="py-3 pl-4 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Invoice No</th>
                          <th scope="col" className="py-3 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Date</th>
                          <th scope="col" className="py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Dollar Rate</th>
                          <th scope="col" className="py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Topup USD</th>
                          <th scope="col" className="py-3 text-right text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">BDT Spent</th>
                          <th scope="col" className="py-3 text-center text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {matchingInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-400 italic text-xs">
                              No top-up records logged in the system billing registry for this account.
                            </td>
                          </tr>
                        ) : (
                          [...matchingInvoices].sort((a,b) => b.date.localeCompare(a.date)).map((inv, idx) => (
                            <tr key={inv.invoiceNo} className="group hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent dark:hover:from-blue-950/10 dark:hover:to-transparent transition-colors">
                              <td className="py-3 pl-4 font-black font-mono text-slate-900 dark:text-white tabular-nums">
                                <span className="inline-flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 font-bold w-6 tabular-nums">#{idx + 1}</span>
                                  {inv.invoiceNo}
                                </span>
                              </td>
                              <td className="py-3 text-slate-500 font-medium tabular-nums">{inv.date}</td>
                              <td className="py-3 text-right font-black text-slate-700 dark:text-slate-300 tabular-nums">৳{inv.dollarRate}</td>
                              <td className="py-3 text-right font-black text-brand-orange tabular-nums tracking-tight">${inv.topupAmountUSD.toLocaleString()}</td>
                              <td className="py-3 text-right font-black text-brand-blue dark:text-blue-400 tabular-nums tracking-tight">৳{inv.totalAmountBDT.toLocaleString()}</td>
                              <td className="py-3 text-center">
                                <span className={`insight-status-chip-${inv.paymentStatus === 'Paid' ? 'paid' : inv.paymentStatus === 'Due' ? 'rose' : 'amber'} insight-status-chip inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border shadow-sm`}>
                                  <span className={`h-1 w-1 rounded-full ${inv.paymentStatus === 'Paid' ? 'bg-emerald-500' : inv.paymentStatus === 'Due' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                  {inv.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/20">
                <FileText size={40} className="text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs font-black text-slate-500">No ad accounts available</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs">Create or assign active ad accounts first in the Ad Accounts register dashboard.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

export default memo(InsightsView);
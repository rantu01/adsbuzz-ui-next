'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './Toast';

const BARE_PATHS = ['/login'];

// Pages managed by Level 1 role permissions ("Level 2 Pages" tab).
const KNOWN_PREFIXES = [
  '/', '/customers', '/sales', '/sale-setup', '/topups', '/refund',
  '/ad-accounts', '/series', '/cards', '/platforms', '/wallets',
  '/vendors', '/invoices', '/reports', '/insights', '/settings',
  '/office-expense',
];

function isKnownPath(pathname) {
  if (pathname === '/') return true;
  return KNOWN_PREFIXES.some((p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)));
}

function AccessDenied({ pathname, roleLabel, onBack }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-slate-950 p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-950 text-red-500 text-2xl font-bold">!</div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Access Restricted</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Your role{roleLabel ? ` (${roleLabel})` : ''} does not have access to <span className="font-mono">{pathname}</span>.
          Please contact your administrator to request access from the Level 1 admin panel.
        </p>
        <button
          onClick={onBack}
          className="mt-6 w-full rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isBare = BARE_PATHS.includes(pathname);
  const { user, loading: authLoading, canAccess, accessLoading, roleLabel } = useAuth();
  const {
    darkMode,
    searchQuery,
    setSearchQuery,
    toasts,
    removeToast,
    toggleTheme,
    customers,
    adAccounts,
    handleSelectCustomerFromHeader,
    handleSelectAdAccountFromHeader,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    handleNavigate,
  } = useApp();

  // Derive active view from pathname
  const activeView = pathname === '/' ? 'dashboard' : pathname.slice(1);

  if (isBare) {
    return <>{children}</>;
  }

  // Gate the app until the session cookie has been validated so protected
  // pages never flash before we know who (if anyone) is signed in.
  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <img src="/images/logo_blue.svg" alt="AdsBuzz" className="h-10 w-auto object-contain" referrerPolicy="no-referrer" />
          <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // Enforce Level 1-managed page access (roles collection) on EVERY page,
  // including direct URL entry — not just sidebar visibility. While access is
  // still loading we render normally to avoid flashing a lock screen.
  // (The server layout applies the same check, so this also holds if client
  // JS is bypassed.) Unknown paths (e.g. /not-found) are left alone.
  const denied = !accessLoading && isKnownPath(pathname) && !canAccess(pathname);

  if (denied) {
    return <AccessDenied pathname={pathname} roleLabel={roleLabel} onBack={() => router.replace('/')} />;
  }

  return (
    <div className={`flex font-sans min-h-screen ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-app-bg text-slate-800'}`} id="app-root-container">
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div id="main-content-pane" className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        <Header
          onSearch={setSearchQuery}
          darkMode={darkMode}
          onToggleTheme={toggleTheme}
          customers={customers}
          adAccounts={adAccounts}
          onSelectCustomer={handleSelectCustomerFromHeader}
          onSelectAdAccount={handleSelectAdAccountFromHeader}
          onMenuToggle={() => setMobileSidebarOpen(true)}
        />

        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

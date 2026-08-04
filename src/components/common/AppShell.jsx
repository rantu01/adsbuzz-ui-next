'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './Toast';

const BARE_PATHS = ['/login'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const isBare = BARE_PATHS.includes(pathname);
  const { user, loading: authLoading } = useAuth();
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
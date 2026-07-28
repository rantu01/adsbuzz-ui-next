'use client';

import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './Toast';

export default function AppShell({ children }) {
  const pathname = usePathname();
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
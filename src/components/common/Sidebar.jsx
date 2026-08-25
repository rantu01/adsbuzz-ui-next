'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  FolderSync,
  ShieldCheck,
  Clock,
  Layers,
  CreditCard,
  Building2,
  FileText,
  BarChart2,
  Settings,
  Globe,
  Wallet,
  Receipt,
  CalendarDays,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';

const MENU_ITEMS = [
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'customers', name: 'Customers', icon: Users },
  { id: 'sales', name: 'Sales Entry', icon: PlusCircle },
  { id: 'sale-setup', name: 'Sale Setup', icon: FolderSync },
  { id: 'topups', name: 'Topups Audit', icon: Clock },
  { id: 'ad-accounts', name: 'Ad Accounts', icon: ShieldCheck },
  { id: 'series', name: 'Series', icon: Layers },
  // { id: 'cards', name: 'Cards', icon: CreditCard },
  {
    id: 'cards',
    name: 'Cards',
    icon: CreditCard,
    children: [
      { id: 'cards', name: 'Cards', icon: CreditCard },
      { id: 'platforms', name: 'Platform', icon: Globe },
      { id: 'wallets', name: 'Wallets', icon: Wallet },
    ],
  },
  { id: 'vendors', name: 'Vendors', icon: Building2 },
  {
    id: 'office-expense',
    name: 'Office Expense',
    icon: Receipt,
    children: [
      { id: 'office-expense', name: 'Dashboard', icon: LayoutDashboard },
      { id: 'office-expense/entry', name: 'Monthly Data Entry', icon: CalendarDays },
      { id: 'office-expense/settings', name: 'Setting', icon: Settings },
    ],
  },
  { id: 'reports', name: 'Reports', icon: FileText },
  { id: 'insights', name: 'Insights', icon: BarChart2 },
  { id: 'invoices', name: 'Invoices', icon: FileText },
  { id: 'settings', name: 'Settings', icon: Settings },
];

export default function Sidebar({ activeView, onNavigate, mobileOpen = false, onMobileClose }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adsbuzz_sidebar_collapsed');
      if (saved !== null) return saved === 'true';
      return window.innerWidth >= 768 && window.innerWidth < 1024;
    }
    return false;
  });

  const [hoveredItem, setHoveredItem] = useState(null);
  const [openMenu, setOpenMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      const active = window.location.pathname;
      if (active === '/platforms' || active === '/wallets') return 'wallet';
    }
    return null;
  });

  const toggleMenu = (id) => {
    setOpenMenu(prev => (prev === id ? null : id));
  };

  useEffect(() => {
    const parent = MENU_ITEMS.find(
      (item) => Array.isArray(item.children) && item.children.some((c) => c.id === activeView),
    );
    if (parent) {
      setOpenMenu(prev => (prev === null ? parent.id : prev));
    }
  }, [activeView]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('adsbuzz_sidebar_collapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) return;
      const saved = localStorage.getItem('adsbuzz_sidebar_collapsed');
      if (saved === null) {
        if (window.innerWidth >= 768 && window.innerWidth < 1024) {
          setIsCollapsed(true);
        } else if (window.innerWidth >= 1024) {
          setIsCollapsed(false);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onMobileClose) {
        onMobileClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      {/* Desktop/Tablet Sidebar */}
      <div
        className="hidden md:flex bg-sidebar-navy text-white flex-col justify-between transition-all duration-300 ease-in-out relative h-screen border-r border-slate-800 flex-shrink-0 z-30 select-none"
        style={{ width: isCollapsed ? '72px' : '240px' }}
        id="sidebar-navigation"
      >
        {/* Brand logo & Toggle Header */}
        <div>
          <div className="p-3.5 flex items-center justify-between border-b border-slate-800/80 h-16">
            {!isCollapsed ? (
              <div className="flex items-center justify-between w-full px-1">
                <img
                  src="/images/logo.svg"
                  alt="AdsBuzz Logo"
                  className="h-[26px] object-contain"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={toggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
                  title="Minimize Sidebar"
                  aria-label="Minimize Sidebar"
                >
                  <PanelLeftClose size={18} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center bg-slate-800/80 border border-slate-700/50 shadow-sm mx-auto">
                  <img
                    src="/images/logo_white.svg"
                    alt="AdsBuzz"
                    className="h-7 w-7 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Collapsed expand button in header */}
          {isCollapsed && (
            <div className="px-3 pt-3 flex justify-center">
              <button
                onClick={toggleCollapse}
                className="w-full py-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 flex items-center justify-center transition-all cursor-pointer group"
                title="Expand Sidebar"
                aria-label="Expand Sidebar"
              >
                <PanelLeftOpen size={18} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          )}

          {/* Menu Navigation Items */}
          <nav className="p-3 space-y-1 mt-3 overflow-y-auto max-h-[calc(100vh-120px)]" id="sidebar-nav">
            {MENU_ITEMS.map((item) => {
              const hasChildren = Array.isArray(item.children) && item.children.length > 0;
              const isChildActive = hasChildren && item.children.some((c) => c.id === activeView);
              const isActive = activeView === item.id || isChildActive;
              const isOpen = openMenu === item.id;
              const Icon = item.icon;

              return (
                <div key={item.id} className="relative group">
                  <button
                    id={`nav-${item.id}`}
                    onClick={() => {
                      if (hasChildren) {
                        toggleMenu(item.id);
                      } else {
                        onNavigate(item.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    aria-label={item.name}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'} rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-brand-orange text-white shadow-md font-bold'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                    }`}
                  >
                    <Icon size={18} className={`flex-shrink-0 transition-transform duration-200 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />

                    {!isCollapsed && (
                      <>
                        <span className="truncate flex-1 text-left">{item.name}</span>
                        {hasChildren && (
                          <ChevronDown
                            size={14}
                            className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-slate-500'}`}
                          />
                        )}
                      </>
                    )}
                  </button>

                  {/* Sleek Floating Tooltip / Submenu in Collapsed Mode */}
                  {isCollapsed && hoveredItem === item.id && (
                    hasChildren ? (
                      <div className="absolute left-full top-0 ml-3 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 py-1.5">
                        <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Icon size={11} />
                          {item.name}
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                          {item.children.map((child) => {
                            const childActive = activeView === child.id;
                            const ChildIcon = child.icon;
                            return (
                              <button
                                key={child.id}
                                onClick={() => onNavigate(child.id)}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-left cursor-pointer transition-colors ${
                                  childActive
                                    ? 'bg-brand-orange text-white'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <ChildIcon size={13} />
                                <span>{child.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-white border border-slate-300 text-slate-900 font-bold text-xs rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                        <span className="text-slate-900 font-bold">{item.name}</span>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />}
                      </div>
                    )
                  )}

                  {/* Expanded Submenu (non-collapsed) */}
                  {!isCollapsed && hasChildren && isOpen && (
                    <div className="mt-1 ml-4 pl-3 border-l border-slate-700/60 space-y-1">
                      {item.children.map((child) => {
                        const childActive = activeView === child.id;
                        const ChildIcon = child.icon;
                        return (
                          <button
                            key={child.id}
                            id={`nav-${child.id}`}
                            onClick={() => onNavigate(child.id)}
                            aria-current={childActive ? 'page' : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer ${
                              childActive
                                ? 'bg-brand-orange text-white shadow-md font-bold'
                                : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                            }`}
                          >
                            <ChildIcon size={16} className={`flex-shrink-0 ${childActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                            <span className="truncate">{child.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden" id="mobile-sidebar-drawer">
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={onMobileClose}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs cursor-pointer"
            />

            {/* Sliding Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="absolute top-0 bottom-0 left-0 w-[270px] bg-sidebar-navy text-white flex flex-col justify-between shadow-2xl border-r border-slate-800"
            >
              <div>
                {/* Brand & Close Header */}
                <div className="p-4 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-2 py-1 w-full max-w-[160px]">
                    <img
                      src="/images/logo.svg"
                      alt="AdsBuzz Logo"
                      className="h-[28px] object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <button
                    onClick={onMobileClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Navigation Items (Scrollable if overflow) */}
                <nav className="p-3 space-y-1 mt-2 overflow-y-auto max-h-[calc(100vh-100px)]" id="mobile-sidebar-nav">
                  {MENU_ITEMS.map((item) => {
                    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
                    const isChildActive = hasChildren && item.children.some((c) => c.id === activeView);
                    const isActive = activeView === item.id || isChildActive;
                    const isOpen = openMenu === item.id;
                    const Icon = item.icon;

                    return (
                      <div key={item.id}>
                        <button
                          id={`mobile-nav-${item.id}`}
                          onClick={() => {
                            if (hasChildren) {
                              toggleMenu(item.id);
                            } else {
                              onNavigate(item.id);
                              if (onMobileClose) onMobileClose();
                            }
                          }}
                          aria-expanded={hasChildren ? isOpen : undefined}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 group cursor-pointer hover:bg-slate-800/50 ${
                            isActive
                              ? 'bg-brand-orange text-white shadow-md font-bold'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon size={16} className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                          <span className="truncate flex-1 text-left">{item.name}</span>
                          {hasChildren && (
                            <ChevronDown size={14} className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-slate-500'}`} />
                          )}
                        </button>

                        {hasChildren && isOpen && (
                          <div className="mt-1 ml-3 pl-3 border-l border-slate-700/60 space-y-1">
                            {item.children.map((child) => {
                              const childActive = activeView === child.id;
                              const ChildIcon = child.icon;
                              return (
                                <button
                                  key={child.id}
                                  id={`mobile-nav-${child.id}`}
                                  onClick={() => {
                                    onNavigate(child.id);
                                    if (onMobileClose) onMobileClose();
                                  }}
                                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 active:scale-95 cursor-pointer hover:bg-slate-800/50 ${
                                    childActive
                                      ? 'bg-brand-orange text-white shadow-md font-bold'
                                      : 'text-slate-400 hover:text-white'
                                  }`}
                                >
                                  <ChildIcon size={14} className={`flex-shrink-0 ${childActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                  <span className="truncate">{child.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </nav>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Bell, Sun, Moon, Keyboard, LogOut, ChevronDown, User, ShieldAlert, Sparkles, X, Menu } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Header({
  onSearch,
  darkMode,
  onToggleTheme,
  customers = [],
  adAccounts = [],
  onSelectCustomer,
  onSelectAdAccount,
  onMenuToggle
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  const { user, logout } = useAuth();
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const displayEmail = user?.email || '';
  const initials = (displayName || 'U').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    setShowProfileDropdown(false);
    logout();
  };

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter accounts/customers for search suggestions dropdown
  const showSuggestions = searchQuery.trim().length > 1;
  const suggestedCustomers = showSuggestions
    ? customers.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.companyName.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 3)
    : [];
  const suggestedAccounts = showSuggestions
    ? adAccounts.filter(acc => acc.adAccountName.toLowerCase().includes(searchQuery.toLowerCase()) || acc.adAccountId.includes(searchQuery)).slice(0, 3)
    : [];

  const handleSuggestionClick = (type, id) => {
    setSearchQuery('');
    if (type === 'customer') {
      onSelectCustomer(id);
    } else {
      onSelectAdAccount(id);
    }
  };

  const handleGlobalSearchChange = (val) => {
    setSearchQuery(val);
    onSearch(val);
  };

  return (
    <header className="bg-sidebar-navy xl:bg-white dark:xl:bg-slate-900 border-b border-slate-800 xl:border-slate-200/80 dark:xl:border-slate-800/80 min-h-[72px] py-3.5 md:py-4 px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm shadow-slate-100/30 dark:shadow-none">

      {/* Mobile Menu Toggle & Brand Indicator */}
      <div className="flex items-center gap-2.5 md:hidden">
        <button
          onClick={onMenuToggle}
          className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/60 cursor-pointer transition-colors"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2">
          <img
            src="/images/logo_blue.svg"
            alt="AdsBuzz Logo"
            className="h-[30px] object-contain hidden md:dark:hidden"
            referrerPolicy="no-referrer"
          />
          <img
            src="/images/logo.svg"
            alt="AdsBuzz Logo"
            className="h-[30px] object-contain md:hidden dark:md:block"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      {/* Search Input Box with Suggestions */}
      <div className="relative w-full max-w-md hidden md:block">
        <div className="relative flex items-center group">
          <input
            id="global-search-input"
            type="text"
            placeholder="Global search customers, ad accounts, BM, series..."
            value={searchQuery}
            onChange={(e) => handleGlobalSearchChange(e.target.value)}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white transition-all duration-200 font-medium placeholder-slate-400 dark:placeholder-slate-500"
          />
          <Search className="absolute left-3.5 text-slate-400/80 dark:text-slate-500/80 group-focus-within:text-brand-blue transition-colors duration-200" size={14} />
        </div>

        {/* Floating suggestions panel */}
        <AnimatePresence>
          {showSuggestions && (suggestedCustomers.length > 0 || suggestedAccounts.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-50 p-2 overflow-hidden"
            >
              {suggestedCustomers.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-1.5 border-b border-slate-50 dark:border-slate-800/50">Customers Matches</p>
                  {suggestedCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSuggestionClick('customer', c.id)}
                      className="w-full text-left text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                    >
                      <span>{c.name}</span>
                      <span className="text-[10px] text-slate-400">{c.companyName}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggestedAccounts.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-3 py-1.5 border-b border-slate-50 dark:border-slate-800/50">Ad Account Matches</p>
                  {suggestedAccounts.map(acc => (
                    <button
                      key={acc.adAccountId}
                      onClick={() => handleSuggestionClick('account', acc.adAccountId)}
                      className="w-full text-left text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 flex items-center justify-between"
                    >
                      <span className="truncate max-w-[200px]">{acc.adAccountName}</span>
                      <span className="text-[10px] text-slate-400">{acc.platform}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right Controls Area */}
      <div className="flex items-center gap-4">

        {/* Real-time Clock display */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-semibold border-r border-slate-200 dark:border-slate-800 pr-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          <span>EBL Rate Feed Active</span>
          <span className="text-slate-500 dark:text-slate-300 font-mono ml-2">{currentTime}</span>
        </div>

        {/* Notifications Tray */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="header-icon-action p-2 text-slate-300 md:text-slate-500 dark:md:text-slate-400 rounded-lg cursor-pointer relative"
            aria-label="Show notifications"
            aria-haspopup="dialog"
            aria-expanded={showNotifications}
          >
            <Bell size={16} />
            <span className="absolute top-1 right-1 h-1.5 w-1.5 bg-orange-500 rounded-full"></span>
          </button>

          <AnimatePresence>
            {showNotifications && (
              <>
                {/* Backdrop overlay to click-to-close */}
                <div
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setShowNotifications(false)}
                />

                {/* Small popup card, positioned absolutely relative to the Bell button */}
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  role="dialog"
                  aria-label="Notifications"
                  className="absolute right-0 top-full mt-2 w-[240px] sm:w-72 md:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-4 z-50 text-xs text-slate-800 dark:text-slate-100"
                >
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">Live Alerts</h4>
                    <span
                      className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-white font-black cursor-pointer"
                      onClick={() => setShowNotifications(false)}
                    >
                      Close
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-1.5 max-h-60 overflow-y-auto">
                    <div className="py-2.5 text-[11px]">
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <ShieldAlert size={12} className="text-red-500" /> Card Limit Reached
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Card MD EBL - 2802 was disabled due to TikTok billing threshold block.</p>
                    </div>
                    <div className="py-2.5 text-[11px]">
                      <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Sparkles size={12} className="text-amber-500" /> Reseller Auto Sync
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Applied +$200 USD top-up for Express IT campaign.</p>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="header-icon-action flex items-center gap-1.5 cursor-pointer rounded-lg"
            id="user-profile-btn"
            aria-label="Open profile menu"
            aria-haspopup="menu"
            aria-expanded={showProfileDropdown}
          >
            <div className="header-profile-avatar h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 md:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700">
              {initials}
            </div>
            <ChevronDown size={14} className="header-profile-chevron text-slate-300 md:text-slate-400" />
          </button>

          <AnimatePresence>
            {showProfileDropdown && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                role="menu"
                aria-label="Profile menu"
                className="absolute right-0 mt-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl w-56 p-2 z-40"
              >
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{displayName}</p>
                  <p className="text-[10px] text-slate-400 truncate">{displayEmail}</p>
                </div>
                <button className="header-profile-menu-item header-profile-menu-item-blue w-full text-left text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer">
                  <User size={14} /> My Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="header-profile-menu-item header-profile-menu-item-red w-full text-left text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} /> Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

    </header>
  );
}
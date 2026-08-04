'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success && data?.user) {
        setUser(data.user);
        return data.user;
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors on logout
    }
    try {
      await signOut(auth);
    } catch {
      // ignore — session already cleared server-side
    }
    setUser(null);
    router.replace('/login');
  }, [router]);

  // Guard protected routes. If the in-memory user is missing, re-validate the
  // session cookie first (a login may have just set it) before bouncing to login.
  useEffect(() => {
    if (loading) return;

    if (pathname === '/login') {
      if (user) router.replace('/');
      return;
    }

    if (!user) {
      refreshSession().then((res) => {
        if (!res) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        }
      });
    }
  }, [loading, user, pathname, router, refreshSession]);

  const value = useMemo(
    () => ({ user, loading, logout, refreshSession }),
    [user, loading, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
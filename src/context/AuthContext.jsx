'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebaseClient';
import { LEVEL2_ROUTES } from '@/lib/rbacCatalog';

const AuthContext = createContext(null);

const MANAGED_L2_PATHS = new Set(LEVEL2_ROUTES.map((r) => r.path));

function pathAllowed(level2Routes, role, pathname) {
  if (!pathname || pathname === '/login') return true;
  if (!level2Routes && role) return true; // not loaded yet or unrestricted — don't flash-block
  if (role === 'admin') return true;
  if (level2Routes === null || level2Routes === undefined) return true;
  if (pathname === '/') return level2Routes.includes('/');
  // Managed pages need an exact match; unmanaged sub-paths inherit the parent.
  if (MANAGED_L2_PATHS.has(pathname)) return level2Routes.includes(pathname);
  return level2Routes.some((p) => p !== '/' && (pathname === p || pathname.startsWith(`${p}/`)));
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState(null); // { role, roleLabel, permissions, level2Routes }

  const fetchAccess = useCallback(async () => {
    try {
      const res = await fetch('/api/roles/me');
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        setAccess({
          role: data.role,
          roleLabel: data.roleLabel,
          permissions: data.permissions || [],
          level2Routes: data.level2Routes,
        });
        return data;
      }
      setAccess(null);
      return null;
    } catch {
      setAccess(null);
      return null;
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success && data?.user) {
        setUser(data.user);
        fetchAccess();
        return data.user;
      }
      setUser(null);
      setAccess(null);
      return null;
    } catch {
      setUser(null);
      setAccess(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fetchAccess]);

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
    setAccess(null);
    router.replace('/login');
  }, [router]);

  const hasPermission = useCallback(
    (permission) => {
      if (!access) return true; // not loaded yet — don't flash-block
      const role = access.role;
      if (role === 'admin') return true;
      return (access.permissions || []).includes(permission);
    },
    [access],
  );

  const canAccess = useCallback(
    (path) => pathAllowed(access?.level2Routes, access?.role || user?.role, path),
    [access, user],
  );

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
    () => ({
      user,
      loading,
      logout,
      refreshSession,
      role: access?.role || user?.role || null,
      roleLabel: access?.roleLabel || null,
      permissions: access?.permissions || [],
      level2Routes: access?.level2Routes,
      accessLoading: !!user && !access,
      hasPermission,
      canAccess,
      refreshAccess: fetchAccess,
    }),
    [user, loading, logout, refreshSession, access, hasPermission, canAccess, fetchAccess],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

'use client';

import { useAuth } from '@/context/AuthContext';

// Gate any UI (buttons, sections, pages) behind a Level 1-managed rule.
// Use ONE of: permission (granular, e.g. "approve_deposits") or route
// (Level 2 page path, e.g. "/vendors"). Renders `fallback` (default: null)
// when access is denied. While access is still loading, children render to
// avoid flashing locked UI.
export default function PermissionGate({ permission, route, fallback = null, children }) {
  const { hasPermission, canAccess, accessLoading } = useAuth();

  if (accessLoading) return <>{children}</>;
  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (route && !canAccess(route)) return <>{fallback}</>;
  return <>{children}</>;
}

// Hook version for imperative checks inside event handlers.
export function useAccess() {
  const { hasPermission, canAccess, role, roleLabel, permissions } = useAuth();
  return { hasPermission, canAccess, role, roleLabel, permissions };
}

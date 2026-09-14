// Role/permission helpers. Static matrices below are FALLBACK defaults — the
// live source of truth is the shared MongoDB `roles` collection managed from
// Level 1 (ad-buzz) at /admin/roles (see lib/rbacCatalog.js + lib/roleModel.js).
//
// Server code should load the live map via getAccessMap() and pass it in:
//   hasPermission(role, perm, access?.permissions)
//   canAccessLevel2Route(pathname, role, access?.routes)

import {
  ROLES,
  ROLE_LABELS,
  STAFF_ROLES,
  PERMISSIONS,
  SYSTEM_ROLE_DEFAULTS,
  LEVEL2_ROUTES,
} from "@/lib/rbacCatalog";

export { ROLES, ROLE_LABELS, PERMISSIONS };

const MANAGED_L2_PATHS = new Set(LEVEL2_ROUTES.map((r) => r.path));

const ROLE_PERMISSIONS = Object.fromEntries(
  SYSTEM_ROLE_DEFAULTS.map((r) => [r.key, r.permissions])
);

const ROLE_LEVEL2_ROUTES = Object.fromEntries(
  SYSTEM_ROLE_DEFAULTS.map((r) => [r.key, r.level2Routes])
);

let permissionOverrides = null;
let level2RouteOverrides = null;

export function setPermissionOverrides(map) {
  permissionOverrides = map || null;
}

export function setLevel2RouteOverrides(map) {
  level2RouteOverrides = map || null;
}

function permsFor(role, overrides) {
  const map = overrides || permissionOverrides;
  if (map && Array.isArray(map[role])) return map[role];
  return ROLE_PERMISSIONS[role] || [];
}

function routesFor(role, overrides) {
  const map = overrides || level2RouteOverrides;
  if (map && (Array.isArray(map[role]) || map[role] === null)) return map[role];
  if (!(role in ROLE_LEVEL2_ROUTES)) return null; // unknown role → unrestricted (legacy)
  return ROLE_LEVEL2_ROUTES[role];
}

export function hasPermission(role, permission, overrides) {
  return permsFor(role, overrides).includes(permission);
}

export function getAllowedRoutes(role, overrides) {
  const routes = [];

  if (
    hasPermission(role, PERMISSIONS.VIEW_DEPOSITS, overrides) ||
    hasPermission(role, PERMISSIONS.APPROVE_DEPOSITS, overrides)
  ) {
    routes.push("deposits");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_WITHDRAWALS, overrides) ||
    hasPermission(role, PERMISSIONS.APPROVE_WITHDRAWALS, overrides)
  ) {
    routes.push("withdrawals");
  }
  if (hasPermission(role, PERMISSIONS.VIEW_AD_ACCOUNTS, overrides)) {
    routes.push("ad-accounts");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_USERS, overrides) ||
    hasPermission(role, PERMISSIONS.CREATE_USERS, overrides)
  ) {
    routes.push("user-management");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_ROLES, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_ROLES, overrides)
  ) {
    routes.push("roles");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_TICKETS, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_TICKETS, overrides)
  ) {
    routes.push("support-tickets");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_PAYMENT_METHODS, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_PAYMENT_METHODS, overrides)
  ) {
    routes.push("payment-methods");
  }
  if (hasPermission(role, PERMISSIONS.VIEW_BALANCE_LOGS, overrides)) {
    routes.push("balance-logs");
  }
  if (hasPermission(role, PERMISSIONS.VIEW_REPORTS, overrides)) {
    routes.push("reports");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_META_API, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_META_API, overrides)
  ) {
    routes.push("meta-api");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_WHATSAPP, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_WHATSAPP, overrides)
  ) {
    routes.push("whatsapp");
  }
  if (
    hasPermission(role, PERMISSIONS.VIEW_SETTINGS, overrides) ||
    hasPermission(role, PERMISSIONS.MANAGE_SETTINGS, overrides)
  ) {
    routes.push("settings");
  }
  if (hasPermission(role, PERMISSIONS.VIEW_TOPUP_INSIGHTS, overrides)) {
    routes.push("top-up-insights");
  }
  if (hasPermission(role, PERMISSIONS.VIEW_AD_ACCOUNTS_TOPUP, overrides)) {
    routes.push("ad-accounts-topup");
  }

  return routes;
}

export function canAccessRoute(role, route, overrides) {
  if (role === ROLES.ADMIN) return true;
  return getAllowedRoutes(role, overrides).includes(route);
}

export function isStaffRole(role) {
  return STAFF_ROLES.includes(role);
}

// Level 2 page access. `allowed` is the role's level2Routes:
// null/undefined → unrestricted (legacy behaviour, never blocks existing users).
// Managed pages (every entry ticked in Level 1) require an EXACT match, so
// unticking e.g. /office-expense/settings blocks it even when the parent
// /office-expense is allowed. Unmanaged sub-paths inherit the nearest parent.
export function canAccessLevel2Route(pathname, role, overrides) {
  if (!pathname || pathname === "/login") return true;
  if (role === ROLES.ADMIN) return true;
  const allowed = routesFor(role, overrides);
  if (allowed === null || allowed === undefined) return true;
  if (pathname === "/") return allowed.includes("/");
  if (MANAGED_L2_PATHS.has(pathname)) return allowed.includes(pathname);
  return allowed.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

export function getLevel2RoutesForRole(role, overrides) {
  const allowed = routesFor(role, overrides);
  if (allowed === null || allowed === undefined) return null;
  return allowed;
}

const ICONS = {
  overview: "LayoutGrid",
  deposits: "DollarSign",
  withdrawals: "DollarSign",
  "ad-accounts": "Megaphone",
  "user-management": "Users",
  roles: "ShieldCheck",
  "support-tickets": "LifeBuoy",
  "balance-logs": "History",
  reports: "BarChart3",
  "meta-api": "RefreshCw",
  whatsapp: "MessageSquare",
  settings: "Settings",
  "top-up-insights": "TrendingUp",
  "ad-accounts-topup": "ArrowUpCircle",
};

export function getNavItemsForRole(role, overrides) {
  const routes = getAllowedRoutes(role, overrides);
  const allItems = [
    { label: "Overview", href: "/admin", key: "overview" },
    { label: "Deposit Verification", href: "/admin/deposits", key: "deposits" },
    { label: "Withdrawals", href: "/admin/withdrawals", key: "withdrawals" },
    { label: "Ad Accounts", href: "/admin/ad-accounts", key: "ad-accounts" },
    {
      label: "Ad Accounts TopUp",
      href: "/admin/ad-accounts-topup",
      key: "ad-accounts-topup",
    },
    {
      label: "User Management",
      href: "/admin/user-management",
      key: "user-management",
    },
    { label: "Roles & Permissions", href: "/admin/roles", key: "roles" },
    {
      label: "Support Tickets",
      href: "/admin/support-tickets",
      key: "support-tickets",
    },
    { label: "Balance Logs", href: "/admin/balance-logs", key: "balance-logs" },
    {
      label: "Top-Up Insights",
      href: "/admin/top-up-insights",
      key: "top-up-insights",
    },
    { label: "Reports", href: "/admin/reports", key: "reports" },
    { label: "Meta API", href: "/admin/meta-api", key: "meta-api" },
    { label: "WhatsApp", href: "/admin/whatsapp", key: "whatsapp" },
    { label: "Settings", href: "/admin/settings", key: "settings" },
  ];

  return allItems
    .filter((item) => (item.key === "overview" ? true : routes.includes(item.key)))
    .map((item) => ({
      ...item,
      icon: ICONS[item.key] || "LayoutGrid",
    }));
}

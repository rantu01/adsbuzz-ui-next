import { ROLE_LABELS, getNavItemsForRole } from "@/lib/permissions";

export function authPayload(user) {
  return {
    user,
    roleLabel: ROLE_LABELS[user?.role] || user?.role || "User",
    navItems: getNavItemsForRole(user?.role),
  };
}
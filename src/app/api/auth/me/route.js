import { requireAuth } from "@/middlewares/auth";
import { asyncHandler, ok } from "@/utils/http";
import { getNavItemsForRole, ROLE_LABELS } from "@/lib/permissions";

export const GET = asyncHandler(async (request) => {
  const { user } = await requireAuth(request);
  return ok({
    user: {
      ...user,
      roleLabel: ROLE_LABELS[user.role] || user.role,
    },
    navItems: getNavItemsForRole(user.role),
  });
});

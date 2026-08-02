import { requireAuth } from "@/middlewares/auth";
import { hasPermission, isStaffRole } from "@/lib/permissions";
import { ApiError, HttpStatus } from "@/utils/http";

export async function requireStaff(request) {
  const auth = await requireAuth(request);
  if (!isStaffRole(auth.user.role)) {
    throw new ApiError(HttpStatus.FORBIDDEN, "Staff access required.");
  }
  return auth;
}

export async function requireAdmin(request) {
  const auth = await requireAuth(request);
  if (auth.user.role !== "admin") {
    throw new ApiError(HttpStatus.FORBIDDEN, "Admin access required.");
  }
  return auth;
}

export function requirePermission(permission) {
  return async (request) => {
    const auth = await requireAuth(request);
    if (!hasPermission(auth.user.role, permission)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "You do not have permission to perform this action."
      );
    }
    return auth;
  };
}

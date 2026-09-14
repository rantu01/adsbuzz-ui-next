import { requireAuth } from "@/middlewares/auth";
import { hasPermission, isStaffRole, canAccessLevel2Route } from "@/lib/permissions";
import { getAccessMap } from "@/lib/roleModel";
import { ApiError, HttpStatus } from "@/utils/http";

let cachedAccess = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30 * 1000;

async function livePermissions() {
  const now = Date.now();
  if (cachedAccess && now - cachedAt < CACHE_TTL_MS) return cachedAccess;
  try {
    cachedAccess = await getAccessMap();
    cachedAt = now;
  } catch {
    cachedAccess = null; // fall back to static matrices in lib/permissions
  }
  return cachedAccess;
}

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

// Dynamic: checks the permissions saved from Level 1 (/admin/roles),
// falling back to the static matrix when the DB is unreachable.
export function requirePermission(permission) {
  return async (request) => {
    const auth = await requireAuth(request);
    const access = await livePermissions();
    if (!hasPermission(auth.user.role, permission, access?.permissions)) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        "You do not have permission to perform this action."
      );
    }
    return auth;
  };
}

// Dynamic: restricts a Level 2 page path (e.g. "/vendors") to roles whose
// level2Routes (managed in Level 1) include it. Unrestricted roles pass.
export function requireLevel2Access(pathname) {
  return async (request) => {
    const auth = await requireAuth(request);
    if (auth.user.role === "admin") return auth;
    const access = await livePermissions();
    if (!canAccessLevel2Route(pathname, auth.user.role, access?.routes)) {
      throw new ApiError(HttpStatus.FORBIDDEN, "You do not have access to this page.");
    }
    return auth;
  };
}

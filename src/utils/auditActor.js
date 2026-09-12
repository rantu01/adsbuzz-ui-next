import { verifySessionCookie } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Resolves the current signed-in user from the session cookie so audit log
 * entries can record who performed each workflow action. Best-effort: returns
 * null when there is no cookie or verification fails, so audit actions never
 * fail just because auth info is unavailable.
 */
export async function getRequestActor(request) {
  const token = request?.cookies?.get?.(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const decoded = await verifySessionCookie(token);
    if (!decoded || !decoded.uid) return null;
    const base = {
      uid: String(decoded.uid),
      name: String(decoded.name || decoded.displayName || ""),
      email: String(decoded.email || ""),
    };
    // Best-effort: attach the DB role + username so edit histories can record
    // which user and which role performed the action.
    try {
      const { getUserByUid } = await import("@/models/userModel");
      const dbUser = await getUserByUid(decoded.uid);
      if (dbUser) {
        const username = dbUser.displayName || dbUser.name || dbUser.username || base.name;
        const role = dbUser.role || decoded.role || "";
        return {
          ...base,
          ...(username ? { name: String(username), username: String(username) } : {}),
          ...(role ? { role: String(role) } : {}),
        };
      }
    } catch {
      // never fail audit resolution because of the enrichment lookup
    }
    return base;
  } catch {
    return null;
  }
}

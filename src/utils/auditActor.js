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
    return {
      uid: String(decoded.uid),
      name: String(decoded.name || decoded.displayName || ""),
      email: String(decoded.email || ""),
    };
  } catch {
    return null;
  }
}

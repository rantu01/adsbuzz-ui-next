import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { getUserByUid } from "@/models/userModel";
import { ApiError, HttpStatus } from "@/utils/http";

export function extractBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function requireAuth(request) {
  const idToken = extractBearerToken(request);

  if (!idToken) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, "Authentication required.");
  }

  let decoded;
  try {
    decoded = await verifyFirebaseToken(idToken);
  } catch (err) {
    console.error("[requireAuth] token verification failed:", err?.message || err);
    throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid or expired token.");
  }

  const user = await getUserByUid(decoded.uid);
  if (!user) {
    throw new ApiError(HttpStatus.UNAUTHORIZED, "User not found.");
  }

  if (user.accountStatus === "frozen") {
    throw new ApiError(HttpStatus.FORBIDDEN, "Your account has been frozen.");
  }

  return { user, uid: decoded.uid, token: decoded };
}

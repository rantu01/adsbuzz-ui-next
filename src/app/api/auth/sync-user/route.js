import { verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { syncAuthenticatedUser } from "@/models/userModel";
import { asyncHandler, ok, badRequest, ApiError, HttpStatus } from "@/utils/http";

export const POST = asyncHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const { uid, email, displayName, phoneNumber } = body || {};

  if (!uid || !email) {
    return badRequest("uid and email are required.");
  }

  let verifiedUid = uid;
  const idToken = (request.headers.get("authorization") || "").match(
    /^Bearer\s+(.+)$/i
  )?.[1];

  if (idToken) {
    try {
      const decoded = await verifyFirebaseToken(idToken);
      verifiedUid = decoded.uid;
    } catch (err) {
      console.error("[sync-user] token verification failed:", err?.message || err);
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid or expired token.");
    }
  }

  const user = await syncAuthenticatedUser({
    uid: verifiedUid,
    email,
    displayName,
    phoneNumber,
  });

  return ok({ message: "User synced.", user });
});

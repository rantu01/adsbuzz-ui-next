import { NextResponse } from "next/server";
import { verifySessionCookie, verifyFirebaseToken } from "@/lib/firebaseAdmin";
import { getUserByUid } from "@/models/userModel";
import { getEffectivePermissions, getEffectiveLevel2Routes } from "@/lib/roleModel";
import { ROLE_LABELS } from "@/lib/rbacCatalog";
import { SESSION_COOKIE } from "@/lib/session";
import { HttpStatus } from "@/utils/http";
import { extractBearerToken } from "@/middlewares/auth";

// Returns the caller's live role, granular permissions and Level 2 page
// access — resolved from the shared `roles` collection managed in Level 1.
// Accepts the session cookie (web app) or a Bearer Firebase ID token (API).
export async function GET(request) {
  let uid = null;

  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionCookie) {
    try {
      const decoded = await verifySessionCookie(sessionCookie);
      uid = decoded.uid;
    } catch {
      // fall through to Bearer check
    }
  }

  if (!uid) {
    const bearer = extractBearerToken(request);
    if (bearer) {
      try {
        const decoded = await verifyFirebaseToken(bearer);
        uid = decoded.uid;
      } catch {
        // invalid token
      }
    }
  }

  if (!uid) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  try {
    const user = await getUserByUid(uid);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found." },
        { status: HttpStatus.UNAUTHORIZED }
      );
    }
    if (user.accountStatus === "frozen") {
      return NextResponse.json(
        { success: false, message: "Your account has been frozen." },
        { status: HttpStatus.FORBIDDEN }
      );
    }

    const role = user.role || "customer";
    const [permissions, level2Routes] = await Promise.all([
      getEffectivePermissions(role),
      getEffectiveLevel2Routes(role),
    ]);

    return NextResponse.json({
      success: true,
      role,
      roleLabel: ROLE_LABELS[role] || role || "User",
      permissions,
      level2Routes,
    });
  } catch (err) {
    console.error("[roles/me] failed:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Failed to resolve role access." },
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}

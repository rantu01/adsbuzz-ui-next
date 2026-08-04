import { NextResponse } from "next/server";
import { verifyFirebaseToken, createBrowserSessionCookie } from "@/lib/firebaseAdmin";
import { getUserByUid } from "@/models/userModel";
import { authPayload } from "@/lib/authResponse";
import { SESSION_COOKIE, SESSION_EXPIRES_MS, sessionCookieOptions } from "@/lib/session";
import { ApiError, HttpStatus } from "@/utils/http";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { idToken } = body || {};

    if (!idToken) {
      return NextResponse.json(
        { success: false, message: "Missing idToken." },
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    const decoded = await verifyFirebaseToken(idToken).catch(() => {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "Invalid or expired token.");
    });

    const user = await getUserByUid(decoded.uid);
    if (!user) {
      throw new ApiError(HttpStatus.UNAUTHORIZED, "User not found.");
    }

    if (user.accountStatus === "frozen") {
      throw new ApiError(HttpStatus.FORBIDDEN, "Your account has been frozen.");
    }

    const sessionCookie = await createBrowserSessionCookie(idToken, SESSION_EXPIRES_MS);

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      ...authPayload(user),
    });

    response.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions());
    return response;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = err instanceof Error ? err.message : "Login failed.";
    return NextResponse.json({ success: false, message }, { status });
  }
}
import { NextResponse } from "next/server";
import { verifySessionCookie } from "@/lib/firebaseAdmin";
import { getUserByUid } from "@/models/userModel";
import { authPayload } from "@/lib/authResponse";
import { SESSION_COOKIE } from "@/lib/session";
import { HttpStatus } from "@/utils/http";

export async function GET(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.json(
      { success: false, message: "Not authenticated." },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  try {
    const decoded = await verifySessionCookie(token);
    const user = await getUserByUid(decoded.uid);

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

    return NextResponse.json({ success: true, ...authPayload(user) });
  } catch (err) {
    console.error("[auth/session] validation failed:", err?.message || err);
    return NextResponse.json(
      { success: false, message: "Invalid or expired session." },
      { status: HttpStatus.UNAUTHORIZED }
    );
  }
}
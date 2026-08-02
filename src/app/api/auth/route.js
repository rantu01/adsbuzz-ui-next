import { NextResponse } from "next/server";

export async function GET() {
  const configured =
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
    Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
    Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);

  return NextResponse.json({
    success: true,
    message: "Auth API ready",
    provider: "firebase",
    configured,
  });
}

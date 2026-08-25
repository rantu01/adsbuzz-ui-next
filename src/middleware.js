import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

// Routes that never require authentication.
const PUBLIC_PATHS = ["/login"];

// Static/style/API paths that middleware should not intercept.
const SKIP_PREFIXES = [
  "/_next/",
  "/favicon.svg",
  "/images/",
  "/uploads/",
  "/api/",
];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Always let public, static, and API routes through.
  if (
    PUBLIC_PATHS.includes(pathname) ||
    SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/ad-accounts/:path*",
    "/cards/:path*",
    "/customers/:path*",
    "/insights/:path*",
    "/invoices/:path*",
    "/reports/:path*",
    "/sale-setup/:path*",
    "/sales/:path*",
    "/series/:path*",
    "/office-expense/:path*",
    "/settings/:path*",
    "/topups/:path*",
    "/vendors/:path*",
  ],
};
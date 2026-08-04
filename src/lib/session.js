export const SESSION_COOKIE = "adsbuzz_session";

export const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days
export const SESSION_EXPIRES_MS = SESSION_MAX_AGE_SECONDS * 1000;

export function sessionCookieOptions({ maxAge = SESSION_MAX_AGE_SECONDS } = {}) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}
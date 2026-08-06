import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SEC } from "@/lib/auth/constants";

export function authCookieOptions(maxAge = AUTH_MAX_AGE_SEC) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function clearAuthCookieOptions() {
  return {
    ...authCookieOptions(0),
    maxAge: 0,
  };
}

export function readTokenFromCookieHeader(cookieHeader?: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === AUTH_COOKIE_NAME) {
      const value = rest.join("=").trim();
      return value || null;
    }
  }
  return null;
}

export { AUTH_COOKIE_NAME };

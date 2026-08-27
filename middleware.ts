import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  const isAuthenticated = Boolean(payload);
  const isProfileCompleted = payload?.isProfileCompleted !== false;

  const isLoginPage = path === "/login";
  const isForgotPasswordPage = path === "/forgot-password";
  const isResetPasswordPage = path === "/reset-password";
  const isProfileSettingsPage = path === "/profile-settings";

  if (!isAuthenticated) {
    if (isLoginPage || isForgotPasswordPage || isResetPasswordPage) {
      return NextResponse.next();
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  if (!isProfileCompleted) {
    if (isProfileSettingsPage) return NextResponse.next();
    return NextResponse.redirect(new URL("/profile-settings", req.url));
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/jwt";

const SUPER_ADMIN_PREFIX = "/super-admin";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyAuthToken(token) : null;
  const isAuthenticated = Boolean(payload);
  const isProfileCompleted = payload?.isProfileCompleted !== false;
  const isPlatformUser = payload?.accessLevel === "platform";

  const isLoginPage = path === "/login";
  const isForgotPasswordPage = path === "/forgot-password";
  const isResetPasswordPage = path === "/reset-password";
  const isProfileSettingsPage = path === "/profile-settings";
  const isSuperAdminRoute = path === SUPER_ADMIN_PREFIX || path.startsWith(`${SUPER_ADMIN_PREFIX}/`);

  if (!isAuthenticated) {
    if (isLoginPage || isForgotPasswordPage || isResetPasswordPage) {
      return NextResponse.next();
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  if (isPlatformUser) {
    if (isSuperAdminRoute) {
      return NextResponse.next();
    }
    if (isLoginPage) {
      return NextResponse.redirect(new URL(`${SUPER_ADMIN_PREFIX}/dashboard`, req.url));
    }
    if (!isProfileSettingsPage) {
      return NextResponse.redirect(new URL(`${SUPER_ADMIN_PREFIX}/dashboard`, req.url));
    }
    return NextResponse.next();
  }

  if (isSuperAdminRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
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

import { normalizeAppRole } from "@/lib/app-role";
import { isSessionSafeImageUrl, sanitizeSessionImageUrl } from "@/lib/session-token";
import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import type { TeamName } from "@/types";

function stripUnsafeJwtPicture(token: Record<string, unknown>) {
  const picture = token.picture;
  if (typeof picture === "string" && !isSessionSafeImageUrl(picture)) {
    delete token.picture;
  }
}

/**
 * Edge-safe auth config (no MongoDB, bcrypt, or other Node-only imports).
 * Middleware must only import this file — not the full `auth.ts`.
 */
export const authConfig = {
  secret:
    process.env.AUTH_SECRET ??
    "dev-colan-auth-secret-minimum-32-characters-long",
  trustHost: true,
  providers: [],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/api") || path === "/") {
        return true;
      }
      const isAuthenticated = !!auth?.user;
      const isProfileCompleted = auth?.user?.isProfileCompleted !== false;
      const isLoginPage = path === "/login";
      const isForgotPasswordPage = path === "/forgot-password";
      const isResetPasswordPage = path === "/reset-password";
      const isProfileSettingsPage = path === "/profile-settings";

      if (!isAuthenticated) {
        return isLoginPage || isForgotPasswordPage || isResetPasswordPage;
      }

      if (!isProfileCompleted) {
        if (isProfileSettingsPage) return true;
        return NextResponse.redirect(new URL("/profile-settings", request.url));
      }

      if (isLoginPage) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      stripUnsafeJwtPicture(token as Record<string, unknown>);

      if (user) {
        const loginEmail =
          (typeof user.email === "string" && user.email) ||
          (typeof user.id === "string" && user.id.includes("@") ? user.id : "");
        if (loginEmail) token.email = loginEmail.toLowerCase().trim();

        token.appRole = user.appRole;
        token.team = user.team;
        token.isProfileCompleted = user.isProfileCompleted;
        token.name = user.name;
        const safeImage = sanitizeSessionImageUrl(user.image);
        if (safeImage) token.picture = safeImage;
        else delete token.picture;
      }
      if (trigger === "update" && session) {
        const patch = session as {
          name?: string;
          image?: string;
          isProfileCompleted?: boolean;
          appRole?: string;
          team?: TeamName;
        };
        if (typeof patch.name === "string" && patch.name) token.name = patch.name;
        if ("image" in patch) {
          const safeImage = sanitizeSessionImageUrl(patch.image);
          if (safeImage) token.picture = safeImage;
          else delete token.picture;
        }
        if ("isProfileCompleted" in patch) {
          token.isProfileCompleted = Boolean(patch.isProfileCompleted);
        }
        if (typeof patch.appRole === "string" && patch.appRole) {
          token.appRole = normalizeAppRole(patch.appRole);
        }
        if ("team" in patch) {
          token.team = patch.team;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? session.user.email ?? "") as string;
        session.user.appRole = normalizeAppRole(token.appRole);
        session.user.team = token.team as TeamName | undefined;
        session.user.isProfileCompleted = token.isProfileCompleted !== false;
        if (typeof token.name === "string" && token.name) session.user.name = token.name;
        const pic = sanitizeSessionImageUrl(token.picture as string | undefined);
        if (pic) session.user.image = pic;
        else delete session.user.image;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

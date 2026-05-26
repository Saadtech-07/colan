import { normalizeAppRole } from "@/lib/permissions";
import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import type { TeamName } from "@/types";

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
      const isProfileSettingsPage = path === "/profile-settings";

      if (!isAuthenticated) {
        return isLoginPage;
      }

      if (!isProfileCompleted) {
        if (isProfileSettingsPage) return true;
        return NextResponse.redirect(new URL("/profile-settings", request.url));
      }

      if (isProfileSettingsPage || isLoginPage) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.appRole = user.appRole;
        token.team = user.team;
        token.isProfileCompleted = user.isProfileCompleted;
        token.name = user.name;
        if (user.image) token.picture = user.image;
      }
      if (trigger === "update" && session) {
        if (typeof session.name === "string" && session.name) token.name = session.name;
        if ("image" in session && session.image !== undefined) token.picture = session.image as string;
        if ("isProfileCompleted" in session) {
          token.isProfileCompleted = Boolean(session.isProfileCompleted);
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
        const pic = token.picture as string | undefined;
        if (pic) session.user.image = pic;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

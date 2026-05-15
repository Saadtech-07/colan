import { normalizeAppRole } from "@/lib/permissions";
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
      if (
        path.startsWith("/api") ||
        path === "/login" ||
        path === "/"
      ) {
        return true;
      }
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.appRole = user.appRole;
        token.team = user.team;
        if (user.image) token.picture = user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? session.user.email ?? "") as string;
        session.user.appRole = normalizeAppRole(token.appRole);
        session.user.team = token.team as TeamName | undefined;
        const pic = token.picture as string | undefined;
        if (pic) session.user.image = pic;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

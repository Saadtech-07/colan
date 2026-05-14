import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import type { AppRole, TeamName } from "@/types";

export const authConfig = {
  secret:
    process.env.AUTH_SECRET ??
    "dev-colan-auth-secret-minimum-32-characters-long",
  trustHost: true,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
        appRole: { label: "Role", type: "text" },
        team: { label: "Team", type: "text" },
      },
      authorize(credentials) {
        if (!credentials?.email || !credentials?.name) return null;
        const email = String(credentials.email);
        const name = String(credentials.name);
        const appRole: AppRole =
          credentials.appRole === "employee" ? "employee" : "admin";
        const team =
          appRole === "employee" && credentials.team
            ? (String(credentials.team) as TeamName)
            : undefined;
        return {
          id: email,
          email,
          name,
          appRole,
          team,
          image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
        };
      },
    }),
  ],
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? session.user.email ?? "") as string;
        session.user.appRole = (token.appRole ?? "employee") as AppRole;
        session.user.team = token.team as TeamName | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

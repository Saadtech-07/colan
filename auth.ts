import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { getAppUserSessionRefresh, verifyAppUserCredentials } from "@/lib/app-users";
import { roleNeedsTeam } from "@/lib/permissions";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import type { AppRole, TeamName } from "@/types";

const SESSION_REFRESH_MS = 30_000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt(params) {
      const baseJwt = authConfig.callbacks.jwt;
      const token = baseJwt ? await baseJwt(params) : params.token;

      const email = [
        params.user?.email,
        token.email,
        params.user?.id,
        token.sub,
      ]
        .find((value): value is string => typeof value === "string" && value.includes("@"))
        ?.toLowerCase()
        .trim();

      if (!email) {
        return token;
      }

      token.email = email;

      const now = Date.now();
      const lastRefresh =
        typeof token.refreshedAt === "number" ? token.refreshedAt : 0;
      const isFreshLogin = Boolean(params.user);
      const forceRefresh =
        isFreshLogin || params.trigger === "update" || now - lastRefresh >= SESSION_REFRESH_MS;

      if (!forceRefresh) {
        return token;
      }

      const fresh = await getAppUserSessionRefresh(email);
      if (!fresh) return token;

      token.name = fresh.name;
      token.appRole = fresh.appRole;
      token.team =
        roleNeedsTeam(fresh.appRole) && fresh.team ? fresh.team : undefined;
      token.isProfileCompleted = fresh.isProfileCompleted;
      const safeImage = sanitizeSessionImageUrl(fresh.imageUrl);
      if (safeImage) token.picture = safeImage;
      else delete token.picture;
      token.refreshedAt = now;

      return token;
    },
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        const password = String(credentials?.password ?? "");
        const row = await verifyAppUserCredentials(email, password);
        if (!row) return null;
        const appRole: AppRole = row.appRole;
        const team =
          roleNeedsTeam(appRole) && row.team ? (row.team as TeamName) : undefined;
        return {
          id: row.email,
          email: row.email,
          name: row.name,
          appRole,
          team,
          image: sanitizeSessionImageUrl(row.imageUrl),
          isProfileCompleted: row.isProfileCompleted,
        };
      },
    }),
  ],
});

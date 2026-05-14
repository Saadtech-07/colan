import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { verifyAppUserCredentials } from "@/lib/app-users";
import type { AppRole, TeamName } from "@/types";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
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
          appRole === "employee" && row.team
            ? (row.team as TeamName)
            : undefined;
        return {
          id: row.email,
          email: row.email,
          name: row.name,
          appRole,
          team,
          image: row.imageUrl,
        };
      },
    }),
  ],
});

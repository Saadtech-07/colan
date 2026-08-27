"use client";

import * as React from "react";
import { dedupeAsync } from "@/lib/dedupe-async";
import type { AuthUser, Session } from "@/types/auth";

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  data: Session | null;
  status: SessionStatus;
  update: (patch?: Partial<AuthUser>) => Promise<Session | null>;
  signOut: (opts?: { callbackUrl?: string }) => Promise<void>;
  refresh: () => Promise<Session | null>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

async function fetchMe(): Promise<Session | null> {
  return dedupeAsync(
    "auth:GET:/api/auth/me",
    async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      const json = (await res.json()) as { user: AuthUser | null };
      if (!json.user) return null;
      return { user: json.user };
    },
    { ttlMs: 8_000 },
  );
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<Session | null>(null);
  const [status, setStatus] = React.useState<SessionStatus>("loading");

  const refresh = React.useCallback(async () => {
    try {
      const session = await fetchMe();
      setData(session);
      setStatus(session ? "authenticated" : "unauthenticated");
      return session;
    } catch {
      setData(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const update = React.useCallback(
    async (_patch?: Partial<AuthUser>) => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        return refresh();
      }
      const json = (await res.json()) as { user: AuthUser };
      const session = { user: json.user };
      setData(session);
      setStatus("authenticated");
      return session;
    },
    [refresh],
  );

  const signOut = React.useCallback(async (opts?: { callbackUrl?: string }) => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setData(null);
    setStatus("unauthenticated");
    window.location.assign(opts?.callbackUrl ?? "/login");
  }, []);

  const value = React.useMemo(
    () => ({ data, status, update, signOut, refresh }),
    [data, status, update, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Drop-in replacement for next-auth/react useSession. */
export function useSession() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useSession must be used within AuthSessionProvider");
  }
  return {
    data: ctx.data,
    status: ctx.status,
    update: ctx.update,
    signOut: ctx.signOut,
  };
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthSessionProvider");
  }
  return ctx;
}


"use client";

import * as React from "react";
import type { TeamAssignableAccount } from "@/lib/team-assignees";

export function useTeamAssignableAccounts(enabled: boolean) {
  const [accounts, setAccounts] = React.useState<TeamAssignableAccount[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/teams/assignable-accounts", {
          credentials: "include",
        });
        if (!res.ok) {
          const message =
            (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(message?.error ?? "Could not load team accounts");
        }
        const data = (await res.json()) as TeamAssignableAccount[];
        if (!cancelled) setAccounts(data);
      } catch (e) {
        if (!cancelled) {
          setAccounts([]);
          setError(e instanceof Error ? e.message : "Could not load team accounts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { accounts, loading, error };
}

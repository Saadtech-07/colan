import { dedupeAsync } from "@/lib/dedupe-async";
import type { TeamAssignableAccount } from "@/lib/team-assignees";

let cache: { at: number; data: TeamAssignableAccount[] } | null = null;
const TTL_MS = 30_000;

export async function fetchTeamAssignableAccounts(opts?: {
  force?: boolean;
}): Promise<TeamAssignableAccount[]> {
  if (
    !opts?.force &&
    cache &&
    Date.now() - cache.at < TTL_MS
  ) {
    return cache.data;
  }

  return dedupeAsync("teams:assignable-accounts", async () => {
    const res = await fetch("/api/teams/assignable-accounts", {
      credentials: "include",
    });
    if (!res.ok) {
      const message = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(message?.error ?? "Could not load team accounts");
    }
    const data = (await res.json()) as TeamAssignableAccount[];
    cache = { at: Date.now(), data };
    return data;
  });
}

export function invalidateTeamAssignableAccountsCache() {
  cache = null;
}

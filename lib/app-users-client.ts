import { dedupeAsync } from "@/lib/dedupe-async";
import type { AppUserPublicDTO } from "@/models/app-user.model";
import {
  clearCachedAppUsers,
  getCachedAppUsers,
  setCachedAppUsers,
} from "@/lib/app-users-page-cache";

export async function fetchAppUsersList(opts?: {
  force?: boolean;
}): Promise<AppUserPublicDTO[]> {
  if (!opts?.force) {
    const cached = getCachedAppUsers();
    if (cached) return cached;
  }

  return dedupeAsync("app-users:list", async () => {
    const res = await fetch("/api/app-users", { credentials: "include" });
    if (!res.ok) {
      throw new Error(`Failed to load app users (${res.status})`);
    }
    const data = (await res.json()) as AppUserPublicDTO[];
    setCachedAppUsers(data);
    return data;
  });
}

export { clearCachedAppUsers, getCachedAppUsers, setCachedAppUsers };

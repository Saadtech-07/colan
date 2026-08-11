import { dedupeAsync } from "@/lib/dedupe-async";

export type ProfileSettingsDTO = {
  name: string;
  appRole: string;
  team?: string;
  isProfileCompleted: boolean;
  imageUrl?: string;
  [key: string]: unknown;
};

let profileCache: { email: string; at: number; data: ProfileSettingsDTO } | null =
  null;

const PROFILE_TTL_MS = 15_000;

export async function fetchProfileSettings(
  email: string,
  opts?: { force?: boolean },
): Promise<ProfileSettingsDTO> {
  const normalized = email.trim().toLowerCase();
  if (
    !opts?.force &&
    profileCache &&
    profileCache.email === normalized &&
    Date.now() - profileCache.at < PROFILE_TTL_MS
  ) {
    return profileCache.data;
  }

  return dedupeAsync(`profile-settings:${normalized}`, async () => {
    const res = await fetch("/api/profile-settings", {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Failed to load profile (${res.status})`);
    }
    const data = (await res.json()) as ProfileSettingsDTO;
    profileCache = { email: normalized, at: Date.now(), data };
    return data;
  }, { ttlMs: PROFILE_TTL_MS, force: opts?.force });
}

export function invalidateProfileSettingsCache() {
  profileCache = null;
}

import type { AppUserPublicDTO } from "@/models/app-user.model";

let cachedUsers: AppUserPublicDTO[] | null = null;

export function getCachedAppUsers(): AppUserPublicDTO[] | null {
  return cachedUsers;
}

export function setCachedAppUsers(users: AppUserPublicDTO[]) {
  cachedUsers = users;
}

export function clearCachedAppUsers() {
  cachedUsers = null;
}

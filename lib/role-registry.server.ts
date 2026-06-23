import {
  hydrateRoleRegistry,
  resetRoleRegistry,
} from "@/lib/role-registry";
import { listWorkspaceRoles } from "@/lib/roles-data";
import type { WorkspaceRole } from "@/models";

let loadPromise: Promise<WorkspaceRole[]> | null = null;

export function invalidateServerRoleCache(): void {
  loadPromise = null;
  resetRoleRegistry();
}

/** Server-only: load roles from MongoDB into the in-memory registry. */
export async function ensureRoleRegistry(): Promise<Map<string, WorkspaceRole>> {
  const { getDb } = await import("@/lib/mongodb");
  const db = await getDb();
  if (db) {
    const { ensureAdminRoleFullAccess } = await import("@/lib/roles-data");
    const restored = await ensureAdminRoleFullAccess(db);
    if (restored) {
      invalidateServerRoleCache();
    }
  }

  let rolesPromise = loadPromise;
  if (!rolesPromise) {
    rolesPromise = listWorkspaceRoles();
    loadPromise = rolesPromise;
  }

  const roles = await rolesPromise;
  hydrateRoleRegistry(roles);
  return new Map(roles.map((r) => [r.key, r]));
}

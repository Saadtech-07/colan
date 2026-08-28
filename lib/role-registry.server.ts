import {
  hydrateRoleRegistry,
  resetRoleRegistry,
} from "@/lib/role-registry";
import { resolveDefaultCompanyId } from "@/lib/companies";
import { listWorkspaceRoles, ensureAdminRoleFullAccess } from "@/lib/roles-data";
import type { WorkspaceRole } from "@/models";

const loadPromises = new Map<string, Promise<WorkspaceRole[]>>();

export function invalidateServerRoleCache(): void {
  loadPromises.clear();
  resetRoleRegistry();
}

/** Server-only: load roles from MongoDB into the in-memory registry. */
export async function ensureRoleRegistry(
  companyId?: string,
): Promise<Map<string, WorkspaceRole>> {
  const resolvedCompanyId = companyId ?? (await resolveDefaultCompanyId());
  let rolesPromise = loadPromises.get(resolvedCompanyId);
  if (!rolesPromise) {
    const { getDb } = await import("@/lib/mongodb");
    const db = await getDb();
    if (db) {
      const restored = await ensureAdminRoleFullAccess(db, resolvedCompanyId);
      if (restored) {
        loadPromises.delete(resolvedCompanyId);
      }
    }
    rolesPromise = listWorkspaceRoles(resolvedCompanyId);
    loadPromises.set(resolvedCompanyId, rolesPromise);
  }

  const roles = await rolesPromise;
  hydrateRoleRegistry(roles);
  return new Map(roles.map((r) => [r.key, r]));
}

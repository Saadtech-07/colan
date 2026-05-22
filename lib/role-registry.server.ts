import {
  getRoleRegistrySize,
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
  if (!loadPromise) {
    loadPromise = listWorkspaceRoles();
  }
  const roles = await loadPromise;
  if (getRoleRegistrySize() === 0) {
    hydrateRoleRegistry(roles);
  }
  return new Map(roles.map((r) => [r.key, r]));
}

import type { WorkspaceRole } from "@/models";

/** In-memory role catalog for client + server permission checks (no MongoDB). */
let registry = new Map<string, WorkspaceRole>();

export function getRoleFromRegistry(key: string): WorkspaceRole | undefined {
  return registry.get(key);
}

export function getRoleRegistrySize(): number {
  return registry.size;
}

export function resetRoleRegistry(): void {
  registry = new Map();
}

/** Populate registry after fetching /api/roles (client or server). */
export function hydrateRoleRegistry(roles: WorkspaceRole[]): void {
  registry = new Map(roles.map((r) => [r.key, r]));
}

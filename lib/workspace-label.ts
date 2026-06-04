import { getRoleDefinition, normalizeAppRole } from "@/lib/permissions";
import { getRoleFromRegistry } from "@/lib/role-registry";

export const WORKSPACE_LOADING_ROLE_LABEL = "Loading...";

/** Role display name for sidebar / dashboard workspace chrome. */
export function resolveWorkspaceRoleLabel(
  appRole: string | undefined | null,
  dataLoading: boolean,
): string {
  if (!appRole) return WORKSPACE_LOADING_ROLE_LABEL;

  const roleKey = normalizeAppRole(appRole);
  const registryRole = getRoleFromRegistry(roleKey);
  if (registryRole) return registryRole.name;

  if (dataLoading) return WORKSPACE_LOADING_ROLE_LABEL;

  return getRoleDefinition(roleKey).label;
}

export function formatWorkspaceSubtitle(
  appRole: string | undefined | null,
  dataLoading: boolean,
): string {
  return `${resolveWorkspaceRoleLabel(appRole, dataLoading)} workspace`;
}

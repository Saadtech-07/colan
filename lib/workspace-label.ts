import { FALLBACK_ROLE_KEY, normalizeAppRole } from "@/lib/app-role";
import { getRoleFromRegistry } from "@/lib/role-registry";

export const WORKSPACE_LOADING_ROLE_LABEL = "Loading...";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** True until the signed-in account role is available from the session. */
export function isWorkspaceRolePending(
  sessionStatus: SessionStatus,
  appRole: string | undefined | null,
): boolean {
  if (sessionStatus === "unauthenticated") return false;
  return !appRole?.trim();
}

/** True while the workspace sync overlay / initial data fetch is in progress. */
export function isWorkspaceChromeLoading(
  sessionStatus: SessionStatus,
  appRole: string | undefined | null,
  dataLoading: boolean,
): boolean {
  if (sessionStatus === "unauthenticated") return false;
  if (!appRole?.trim()) return true;
  return dataLoading;
}

function formatRoleKeyAsLabel(roleKey: string): string {
  if (roleKey === FALLBACK_ROLE_KEY) return "Employee";
  return roleKey
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Role display name for sidebar / dashboard workspace chrome. */
export function resolveWorkspaceRoleLabel(appRole: string | undefined | null): string {
  if (!appRole?.trim()) return WORKSPACE_LOADING_ROLE_LABEL;

  const roleKey = normalizeAppRole(appRole);
  const registryRole = getRoleFromRegistry(roleKey);
  if (registryRole) return registryRole.name;

  return formatRoleKeyAsLabel(roleKey);
}

export function formatWorkspaceSubtitle(
  appRole: string | undefined | null,
  options?: { sessionStatus?: SessionStatus; dataLoading?: boolean },
): string {
  const sessionStatus = options?.sessionStatus ?? "authenticated";
  const dataLoading = options?.dataLoading ?? false;
  if (isWorkspaceChromeLoading(sessionStatus, appRole, dataLoading)) {
    return `${WORKSPACE_LOADING_ROLE_LABEL} workspace`;
  }
  return `${resolveWorkspaceRoleLabel(appRole)} workspace`;
}

export function resolveWorkspaceRoleLabelForChrome(
  appRole: string | undefined | null,
  options?: { sessionStatus?: SessionStatus; dataLoading?: boolean },
): string {
  const sessionStatus = options?.sessionStatus ?? "authenticated";
  const dataLoading = options?.dataLoading ?? false;
  if (isWorkspaceChromeLoading(sessionStatus, appRole, dataLoading)) {
    return WORKSPACE_LOADING_ROLE_LABEL;
  }
  return resolveWorkspaceRoleLabel(appRole);
}

import { getRoleFromRegistry } from "@/lib/role-registry";
import { normalizeAppRole } from "@/lib/permissions";
import type { AppRole, ProjectManagerSummary } from "@/types";

export type { ProjectManagerSummary };

const PROJECT_MANAGER_KEY_HINTS = new Set([
  "project-manager",
  "project_manager",
  "projectmanager",
]);

export function isProjectManagerAppRole(roleKey: AppRole): boolean {
  const key = normalizeAppRole(roleKey).toLowerCase();
  if (PROJECT_MANAGER_KEY_HINTS.has(key)) return true;

  const role = getRoleFromRegistry(roleKey);
  if (role?.name.toLowerCase().includes("project manager")) return true;

  return false;
}

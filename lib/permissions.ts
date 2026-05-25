import {
  NAV_PATH_MODULES,
  normalizeModulePermissions,
  resolveLegacyAccess,
  type ModulePermissionsMap,
  type RbacModule,
} from "@/lib/rbac-modules";
import { getRoleFromRegistry } from "@/lib/role-registry";
import type { Employee, Project, TeamName } from "@/types";
import type { WorkspaceRole } from "@/models";

export type Permission =
  | "employees:read"
  | "employees:read_all"
  | "employees:write"
  | "projects:read"
  | "projects:read_all"
  | "projects:manage"
  | "projects:manage_team"
  | "gallery:read"
  | "gallery:write"
  | "seating:read"
  | "seating:assign"
  | "seating:assign_team"
  | "roles:read"
  | "roles:manage"
  | "appUsers:read"
  | "appUsers:manage";

export type RoleDefinition = {
  role: string;
  label: string;
  description: string;
  responsibilities: string[];
  scopes: string[];
  permissions: Permission[];
  color: string;
  modules: ModulePermissionsMap;
};

import type { AppRole } from "@/types";

const FALLBACK_ROLE_KEY = "employee";

export function normalizeAppRole(value: unknown): AppRole {
  if (typeof value === "string" && value.trim()) return value.trim();
  return FALLBACK_ROLE_KEY;
}

function fallbackRoleDefinition(): RoleDefinition {
  return {
    role: FALLBACK_ROLE_KEY,
    label: "Employee",
    description: "Default contributor access.",
    responsibilities: [],
    scopes: [],
    permissions: ["projects:read", "employees:read", "gallery:read", "seating:read", "roles:read"],
    color: "#64748b",
    modules: normalizeModulePermissions({
      dashboard: { view: true, manage: false },
      projects: { view: true, manage: false },
      teamMembers: { view: true, manage: false },
      seating: { view: true, manage: false },
      gallery: { view: true, manage: false },
      roles: { view: true, manage: false },
      appUsers: { view: false, manage: false },
    }),
  };
}

export function workspaceRoleToDefinition(role: WorkspaceRole): RoleDefinition {
  return {
    role: role.key,
    label: role.name,
    description: role.description,
    responsibilities: role.responsibilities,
    scopes: role.scopes,
    permissions: role.resolvedPermissions as Permission[],
    color: role.color,
    modules: role.permissions,
  };
}

export function getRoleDefinition(roleKey: AppRole): RoleDefinition {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return fallbackRoleDefinition();
  return workspaceRoleToDefinition(role);
}

export function roleNeedsTeam(roleKey: AppRole): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return roleKey === "lead" || roleKey === "employee";
  return role.teamScopedProjects || roleKey === "lead" || roleKey === "employee";
}

export function hasPermission(roleKey: AppRole, permission: Permission): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return fallbackRoleDefinition().permissions.includes(permission);
  return role.resolvedPermissions.includes(permission);
}

export function canViewModule(roleKey: AppRole, module: RbacModule): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return module === "dashboard";
  return role.permissions[module]?.view ?? false;
}

export function canManageModule(roleKey: AppRole, module: RbacModule): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return false;
  return role.permissions[module]?.manage ?? false;
}

export function canAccessNav(roleKey: AppRole, href: string): boolean {
  const module = NAV_PATH_MODULES[href];
  if (!module) {
    if (href.startsWith("/projects/")) {
      return canViewModule(roleKey, "projects");
    }
    if (href.startsWith("/team-members/")) {
      return canViewModule(roleKey, "teamMembers");
    }
    return true;
  }
  return canViewModule(roleKey, module);
}

export function canManageProjects(roleKey: AppRole): boolean {
  return (
    hasPermission(roleKey, "projects:manage") ||
    hasPermission(roleKey, "projects:manage_team")
  );
}

/** Admin, Manager, and Project Lead — may assign squad projects to employees. */
export function canAssignEmployeeProjects(roleKey: AppRole): boolean {
  return canManageProjects(roleKey);
}

export function canManageProjectForTeam(
  roleKey: AppRole,
  projectTeam: TeamName,
  userTeam?: TeamName,
): boolean {
  if (hasPermission(roleKey, "projects:manage")) return true;
  if (hasPermission(roleKey, "projects:manage_team")) {
    return !!userTeam && userTeam === projectTeam;
  }
  return false;
}

export function filterProjectsForUser(
  projects: Project[],
  roleKey: AppRole,
  userTeam?: TeamName,
): Project[] {
  if (hasPermission(roleKey, "projects:read_all")) return projects;
  if (userTeam) {
    return projects.filter((p) => p.teams.includes(userTeam));
  }
  return [];
}

export function canManageProject(
  roleKey: AppRole,
  projectTeams: TeamName[],
  userTeam?: TeamName,
): boolean {
  return projectTeams.some((t) =>
    canManageProjectForTeam(roleKey, t, userTeam),
  );
}

export function filterEmployeesForUser(
  employees: Employee[],
  roleKey: AppRole,
  userTeam?: TeamName,
): Employee[] {
  if (hasPermission(roleKey, "employees:read_all")) return employees;
  if (userTeam) return employees.filter((e) => e.team === userTeam);
  return employees;
}

export function canWriteEmployees(roleKey: AppRole): boolean {
  return canManageModule(roleKey, "teamMembers");
}

export function canAssignSeating(roleKey: AppRole): boolean {
  return (
    hasPermission(roleKey, "seating:assign") ||
    hasPermission(roleKey, "seating:assign_team")
  );
}

export function canAssignEmployeeToBay(
  roleKey: AppRole,
  employee: Employee | undefined,
  userTeam?: TeamName,
): boolean {
  if (hasPermission(roleKey, "seating:assign")) return true;
  if (hasPermission(roleKey, "seating:assign_team")) {
    if (!employee || !userTeam) return false;
    return employee.team === userTeam;
  }
  return false;
}

export function canWriteGallery(roleKey: AppRole): boolean {
  return roleKey === "admin";
}

export function buildAccessContext(roleKey: AppRole, team?: TeamName) {
  const def = getRoleDefinition(roleKey);
  return {
    role: roleKey,
    team,
    definition: def,
    modules: def.modules,
    canView: (module: RbacModule) => canViewModule(roleKey, module),
    canManage: (module: RbacModule) => canManageModule(roleKey, module),
    canManageProjects: canManageProjects(roleKey),
    canWriteEmployees: canWriteEmployees(roleKey),
    canAssignSeating: canAssignSeating(roleKey),
    canWriteGallery: canWriteGallery(roleKey),
    seesAllTeams:
      hasPermission(roleKey, "projects:read_all") ||
      hasPermission(roleKey, "employees:read_all"),
    has: (permission: Permission) => hasPermission(roleKey, permission),
  };
}

export type AccessContext = ReturnType<typeof buildAccessContext>;

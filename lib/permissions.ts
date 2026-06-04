import {
  NAV_PATH_MODULES,
  hasModulePermissionAction,
  moduleHasAnyAccess,
  normalizeModulePermissions,
  type ModulePermissionsMap,
  type RbacModule,
} from "@/lib/rbac-modules";
import { teamMatchKey } from "@/lib/team-utils";
import { getRoleFromRegistry } from "@/lib/role-registry";
import type { Employee, Project, TeamName } from "@/types";
import type { WorkspaceRole } from "@/models";

export type Permission =
  | "dashboard:view"
  | "dashboard:analytics"
  | "dashboard:export"
  | "dashboard:manage"
  | "projects:view"
  | "projects:create"
  | "projects:edit"
  | "projects:delete"
  | "projects:assign"
  | "projects:change_status"
  | "employees:read"
  | "employees:read_all"
  | "employees:write"
  | "teamMembers:view"
  | "teamMembers:create"
  | "teamMembers:edit"
  | "teamMembers:delete"
  | "teamMembers:assign_projects"
  | "teamMembers:export"
  | "teamMembers:manage"
  | "projects:read"
  | "projects:read_all"
  | "projects:manage"
  | "projects:manage_team"
  | "gallery:view"
  | "gallery:upload"
  | "gallery:edit"
  | "gallery:delete"
  | "gallery:manage"
  | "gallery:read"
  | "gallery:write"
  | "seating:view"
  | "seating:assign_seats"
  | "seating:edit_layout"
  | "seating:manage"
  | "seating:read"
  | "seating:assign"
  | "seating:assign_team"
  | "roles:view"
  | "roles:create"
  | "roles:edit"
  | "roles:delete"
  | "roles:manage_permissions"
  | "roles:manage"
  | "roles:read"
  | "appUsers:view"
  | "appUsers:create"
  | "appUsers:edit"
  | "appUsers:delete"
  | "appUsers:invite"
  | "appUsers:suspend"
  | "appUsers:manage"
  | "appUsers:read"
  | "chat:view"
  | "chat:send"
  | "chat:manage";

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
import { FALLBACK_ROLE_KEY, normalizeAppRole } from "@/lib/app-role";

export { FALLBACK_ROLE_KEY, normalizeAppRole };

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
      chat: { view: true, manage: false, actions: { send: true } },
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

const SQUAD_CONTRIBUTOR_ROLE_KEYS = new Set([
  "employee",
  "lead",
  "co-lead",
  "co_lead",
  "colead",
]);

/** Squad contributors need an employee ID and team assignment. */
export function roleNeedsEmployeeIdentity(roleKey: AppRole): boolean {
  return SQUAD_CONTRIBUTOR_ROLE_KEYS.has(normalizeAppRole(roleKey).toLowerCase());
}

export function roleNeedsTeam(roleKey: AppRole): boolean {
  return roleNeedsEmployeeIdentity(roleKey);
}

export function hasPermission(roleKey: AppRole, permission: Permission): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return fallbackRoleDefinition().permissions.includes(permission);
  return role.resolvedPermissions.includes(permission);
}

export function canAccessModuleAction(
  roleKey: AppRole,
  module: RbacModule,
  actionKey: string,
): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return false;
  return hasModulePermissionAction(module, role.permissions[module], actionKey);
}

export function canViewModule(roleKey: AppRole, module: RbacModule): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return module === "dashboard";
  return moduleHasAnyAccess(role.permissions[module]);
}

export function canManageModule(roleKey: AppRole, module: RbacModule): boolean {
  const role = getRoleFromRegistry(roleKey);
  if (!role) return false;
  return role.permissions[module]?.manage ?? false;
}

export function canAccessNav(roleKey: AppRole, href: string): boolean {
  const matchedModule = NAV_PATH_MODULES[href];
  if (!matchedModule) {
    if (href.startsWith("/projects/")) {
      return canViewModule(roleKey, "projects");
    }
    if (href.startsWith("/team-members/")) {
      return canViewModule(roleKey, "teamMembers");
    }
    return true;
  }
  return canViewModule(roleKey, matchedModule);
}

export function canManageProjects(roleKey: AppRole): boolean {
  return (
    canAccessModuleAction(roleKey, "projects", "create") ||
    canAccessModuleAction(roleKey, "projects", "edit") ||
    canAccessModuleAction(roleKey, "projects", "delete") ||
    canAccessModuleAction(roleKey, "projects", "assign") ||
    canAccessModuleAction(roleKey, "projects", "changeStatus") ||
    hasPermission(roleKey, "projects:manage") ||
    hasPermission(roleKey, "projects:manage_team")
  );
}

/** Admin, Manager, and Project Lead — may assign squad projects to employees. */
export function canAssignEmployeeProjects(roleKey: AppRole): boolean {
  return (
    canAccessModuleAction(roleKey, "projects", "assign") || canManageProjects(roleKey)
  );
}

export function canManageProjectForTeam(
  roleKey: AppRole,
  projectTeam: TeamName,
  userTeam?: TeamName,
): boolean {
  if (
    canAccessModuleAction(roleKey, "projects", "create") ||
    canAccessModuleAction(roleKey, "projects", "edit") ||
    canAccessModuleAction(roleKey, "projects", "delete") ||
    canAccessModuleAction(roleKey, "projects", "assign") ||
    canAccessModuleAction(roleKey, "projects", "changeStatus")
  ) {
    if (!userTeam || !hasPermission(roleKey, "projects:manage_team")) {
      return true;
    }
    return userTeam === projectTeam;
  }
  if (hasPermission(roleKey, "projects:manage")) return true;
  if (hasPermission(roleKey, "projects:manage_team")) {
    return !!userTeam && userTeam === projectTeam;
  }
  return false;
}

const PORTFOLIO_ROLE_KEYS = new Set(["admin", "manager"]);

/** Company-wide project visibility (admin, manager, portfolio roles). */
export function canViewAllWorkspaceProjects(roleKey: AppRole): boolean {
  if (PORTFOLIO_ROLE_KEYS.has(normalizeAppRole(roleKey).toLowerCase())) return true;
  if (hasPermission(roleKey, "projects:read_all")) return true;
  if (hasPermission(roleKey, "projects:manage")) return true;
  if (canManageModule(roleKey, "appUsers")) return true;
  if (canManageModule(roleKey, "projects") && !hasPermission(roleKey, "projects:manage_team")) {
    return true;
  }
  return false;
}

export function filterProjectsForUser(
  projects: Project[],
  roleKey: AppRole,
  userTeam?: TeamName,
): Project[] {
  if (canViewAllWorkspaceProjects(roleKey)) return projects;
  if (userTeam) {
    const squadKey = teamMatchKey(userTeam);
    return projects.filter((p) =>
      p.teams.some((t) => t === userTeam || teamMatchKey(t) === squadKey),
    );
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
  return (
    canManageModule(roleKey, "teamMembers") ||
    canAccessModuleAction(roleKey, "teamMembers", "create") ||
    canAccessModuleAction(roleKey, "teamMembers", "edit") ||
    canAccessModuleAction(roleKey, "teamMembers", "delete") ||
    canAccessModuleAction(roleKey, "teamMembers", "assignProjects")
  );
}

export function canAssignSeating(roleKey: AppRole): boolean {
  return (
    canAccessModuleAction(roleKey, "seating", "assignSeats") ||
    hasPermission(roleKey, "seating:assign") ||
    hasPermission(roleKey, "seating:assign_team")
  );
}

export function canAssignEmployeeToBay(
  roleKey: AppRole,
  employee: Employee | undefined,
  userTeam?: TeamName,
): boolean {
  if (
    canAccessModuleAction(roleKey, "seating", "assignSeats") &&
    !hasPermission(roleKey, "seating:assign_team")
  ) {
    return true;
  }
  if (hasPermission(roleKey, "seating:assign")) return true;
  if (hasPermission(roleKey, "seating:assign_team")) {
    if (!employee || !userTeam) return false;
    return employee.team === userTeam;
  }
  return false;
}

export function canWriteGallery(roleKey: AppRole): boolean {
  return (
    canManageModule(roleKey, "gallery") ||
    canAccessModuleAction(roleKey, "gallery", "upload") ||
    canAccessModuleAction(roleKey, "gallery", "edit") ||
    canAccessModuleAction(roleKey, "gallery", "delete")
  );
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
    canAccess: (module: RbacModule, actionKey: string) =>
      canAccessModuleAction(roleKey, module, actionKey),
    canManageProjects: canManageProjects(roleKey),
    canWriteEmployees: canWriteEmployees(roleKey),
    canAssignSeating: canAssignSeating(roleKey),
    canWriteGallery: canWriteGallery(roleKey),
    seesAllTeams:
      canViewAllWorkspaceProjects(roleKey) ||
      hasPermission(roleKey, "employees:read_all"),
    has: (permission: Permission) => hasPermission(roleKey, permission),
  };
}

export type AccessContext = ReturnType<typeof buildAccessContext>;

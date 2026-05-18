import type { AppRole, Employee, Project, TeamName } from "@/types";

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
  | "roles:read";

export type RoleDefinition = {
  role: AppRole;
  label: string;
  description: string;
  responsibilities: string[];
  scopes: string[];
  permissions: Permission[];
};

const ALL_PERMISSIONS: Permission[] = [
  "employees:read",
  "employees:read_all",
  "employees:write",
  "projects:read",
  "projects:read_all",
  "projects:manage",
  "projects:manage_team",
  "gallery:read",
  "gallery:write",
  "seating:read",
  "seating:assign",
  "seating:assign_team",
  "roles:read",
];

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  admin: {
    role: "admin",
    label: "Admin",
    description:
      "Full workspace control — employees, projects, seating, gallery, and future permission policies.",
    responsibilities: [
      "Manage the employee directory and org-wide settings",
      "Create and oversee all team projects and gallery content",
      "Assign seating across the full floor plan",
      "Define access policies for managers, leads, and contributors",
    ],
    scopes: [
      "All modules",
      "User administration",
      "Org settings",
      "Full project portfolio",
    ],
    permissions: ALL_PERMISSIONS,
  },
  manager: {
    role: "manager",
    label: "Manager",
    description:
      "Operational oversight across teams with approval workflows and reporting.",
    responsibilities: [
      "Review and approve project timelines across teams",
      "Create and update projects for any squad",
      "Monitor delivery health and team workload",
      "Publish gallery updates for company-wide visibility",
    ],
    scopes: ["All team projects", "Cross-team reporting", "Gallery publishing"],
    permissions: [
      "employees:read",
      "employees:read_all",
      "projects:read",
      "projects:read_all",
      "projects:manage",
      "gallery:read",
      "gallery:write",
      "seating:read",
      "roles:read",
    ],
  },
  lead: {
    role: "lead",
    label: "Project Lead",
    description:
      "Leads delivery for a squad — prioritization, standups, and unblockers.",
    responsibilities: [
      "Own the squad backlog and sprint priorities",
      "Create and update projects for your assigned team",
      "Assign seating for members on your team",
      "Keep the team directory accurate for your squad",
    ],
    scopes: ["Team backlog", "Squad assignments", "Team seating"],
    permissions: [
      "employees:read",
      "projects:read",
      "projects:manage_team",
      "gallery:read",
      "seating:read",
      "seating:assign_team",
      "roles:read",
    ],
  },
  employee: {
    role: "employee",
    label: "Employee",
    description:
      "Contributing member with read access to assigned team projects and workspace updates.",
    responsibilities: [
      "Execute work on assigned team projects",
      "Stay current on team announcements and gallery posts",
      "View squad roster and seating for your team",
    ],
    scopes: ["Assigned team projects", "Team directory (read-only)", "Gallery"],
    permissions: [
      "employees:read",
      "projects:read",
      "gallery:read",
      "seating:read",
      "roles:read",
    ],
  },
};

export const APP_ROLES = Object.keys(ROLE_DEFINITIONS) as AppRole[];

export function normalizeAppRole(value: unknown): AppRole {
  if (value === "admin" || value === "manager" || value === "lead" || value === "employee") {
    return value;
  }
  return "employee";
}

export function getRoleDefinition(role: AppRole): RoleDefinition {
  return ROLE_DEFINITIONS[role];
}

export function roleNeedsTeam(role: AppRole): boolean {
  return role === "lead" || role === "employee";
}

export function hasPermission(role: AppRole, permission: Permission): boolean {
  return ROLE_DEFINITIONS[role].permissions.includes(permission);
}

export function canAccessNav(role: AppRole, href: string): boolean {
  switch (href) {
    case "/dashboard":
      return true;
    case "/team-members":
      return hasPermission(role, "employees:read");
    case "/gallery":
      return hasPermission(role, "gallery:read");
    case "/seating":
      return hasPermission(role, "seating:read");
    case "/roles":
      return hasPermission(role, "roles:read");
    case "/projects":
      return hasPermission(role, "projects:read");
    case "/app-users":
      return role === "admin";
    default:
      return href.startsWith("/projects/")
        ? hasPermission(role, "projects:read")
        : true;
  }
}

export function canManageProjects(role: AppRole): boolean {
  return hasPermission(role, "projects:manage") || hasPermission(role, "projects:manage_team");
}

export function canManageProjectForTeam(
  role: AppRole,
  projectTeam: TeamName,
  userTeam?: TeamName,
): boolean {
  if (hasPermission(role, "projects:manage")) return true;
  if (hasPermission(role, "projects:manage_team")) {
    return !!userTeam && userTeam === projectTeam;
  }
  return false;
}

export function filterProjectsForUser(
  projects: Project[],
  role: AppRole,
  userTeam?: TeamName,
): Project[] {
  if (hasPermission(role, "projects:read_all")) return projects;
  if (userTeam) return projects.filter((p) => p.team === userTeam);
  return [];
}

export function filterEmployeesForUser(
  employees: Employee[],
  role: AppRole,
  userTeam?: TeamName,
): Employee[] {
  if (hasPermission(role, "employees:read_all")) return employees;
  if (userTeam) return employees.filter((e) => e.team === userTeam);
  return employees;
}

export function canWriteEmployees(role: AppRole): boolean {
  return hasPermission(role, "employees:write");
}

export function canAssignSeating(role: AppRole): boolean {
  return hasPermission(role, "seating:assign") || hasPermission(role, "seating:assign_team");
}

export function canAssignEmployeeToBay(
  role: AppRole,
  employee: Employee | undefined,
  userTeam?: TeamName,
): boolean {
  if (hasPermission(role, "seating:assign")) return true;
  if (hasPermission(role, "seating:assign_team")) {
    if (!employee || !userTeam) return false;
    return employee.team === userTeam;
  }
  return false;
}

export function canWriteGallery(role: AppRole): boolean {
  return hasPermission(role, "gallery:write");
}

export function buildAccessContext(role: AppRole, team?: TeamName) {
  const def = getRoleDefinition(role);
  return {
    role,
    team,
    definition: def,
    canManageProjects: canManageProjects(role),
    canWriteEmployees: canWriteEmployees(role),
    canAssignSeating: canAssignSeating(role),
    canWriteGallery: canWriteGallery(role),
    seesAllTeams:
      hasPermission(role, "projects:read_all") ||
      hasPermission(role, "employees:read_all"),
    has: (permission: Permission) => hasPermission(role, permission),
  };
}

export type AccessContext = ReturnType<typeof buildAccessContext>;

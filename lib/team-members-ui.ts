import { canAssignEmployeeProjects } from "@/lib/permissions";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { isValidSeatId } from "@/lib/seating-layout";
import type { AccessContext } from "@/lib/permissions";
import type { WorkspaceRole } from "@/models";
import type { Employee, Project, TeamName } from "@/types";

const LEGACY_ROLE_LABELS: Record<string, string[]> = {
  lead: ["Team Lead", "Project Lead"],
};

const DIRECTORY_LEAD_ROLES = new Set<string>(LEGACY_ROLE_LABELS.lead);

export function buildTeamMemberRoleFilterOptions(workspaceRoles: WorkspaceRole[]) {
  return [
    { value: "all", label: "All" },
    ...workspaceRoles.map((role) => ({
      value: role.key,
      label: role.name,
    })),
  ];
}

export function employeeMatchesRoleFilter(
  employee: Pick<Employee, "role">,
  roleFilterKey: string,
  workspaceRoles: WorkspaceRole[],
) {
  if (roleFilterKey === "all") return true;

  const role = workspaceRoles.find((item) => item.key === roleFilterKey);
  if (!role) return false;
  if (employee.role === role.name) return true;

  const legacyLabels = LEGACY_ROLE_LABELS[roleFilterKey];
  return legacyLabels?.includes(employee.role) ?? false;
}

export type WorkforceAccess = {
  canManageEmployees: boolean;
  canAssignProjects: boolean;
  canEditProfiles: boolean;
  canViewAnalytics: boolean;
  canManageRoles: boolean;
  canExportDirectory: boolean;
  canInviteMembers: boolean;
  canViewProfile: boolean;
};

export type WorkforceAnalytics = {
  totalEmployees: number;
  activeTeams: number;
  projectLeads: number;
  employeesWithoutProjects: number;
  availableEmployees: number;
  activeProjectsAssigned: number;
};

export function buildWorkforceAccess(access: AccessContext | null): WorkforceAccess {
  const canManageEmployees = !!access?.canWriteEmployees;
  const canAssignProjects = !!access && canAssignEmployeeProjects(access.role);

  return {
    canManageEmployees,
    canAssignProjects,
    canEditProfiles: canManageEmployees,
    canViewAnalytics: !!access,
    canManageRoles: !!access?.canManage("roles"),
    canExportDirectory: canManageEmployees,
    canInviteMembers: canManageEmployees,
    canViewProfile: !!access,
  };
}

export function employeeAssignedProjects(employee: Pick<Employee, "id" | "team">, projects: Project[]) {
  return getProjectsForEmployee(employee.id, projects);
}

export function employeeActiveProjects(employee: Pick<Employee, "id" | "team">, projects: Project[]) {
  return employeeAssignedProjects(employee, projects).filter(
    (project) => project.status !== "Completed",
  );
}

export function employeeWorkloadPercent(
  employee: Pick<Employee, "id" | "team" | "role">,
  projects: Project[],
) {
  const active = employeeActiveProjects(employee, projects).length;
  const base = Math.min(active * 28, 100);
  const roleBoost = employee.role === "Team Lead" ? 10 : employee.role === "Manager" ? 8 : 0;
  return Math.min(base + roleBoost, 100);
}

export function employeeAvailabilityState(
  employee: Pick<Employee, "id" | "team" | "role">,
  projects: Project[],
) {
  const workload = employeeWorkloadPercent(employee, projects);

  if (workload >= 85) {
    return {
      label: "At capacity",
      toneClass: "border-transparent bg-destructive/10 text-destructive",
    };
  }
  if (workload >= 55) {
    return {
      label: "Busy",
      toneClass:
        "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Available",
    toneClass: "border-transparent bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  };
}

export type EmployeeWorkspaceStatus = {
  label: string;
  toneClass: string;
  isAssigned: boolean;
  zoneLabel?: string;
};

export function normalizeEmployeeBayNumber(bayNumber?: string) {
  return bayNumber?.trim() ?? "";
}

export function hasAssignedWorkspaceSeat(employee: Pick<Employee, "bayNumber">) {
  const bay = normalizeEmployeeBayNumber(employee.bayNumber);
  return bay.length > 0 && isValidSeatId(bay);
}

export function employeeWorkspaceStatus(
  employee: Pick<Employee, "bayNumber">,
): EmployeeWorkspaceStatus {
  const bay = normalizeEmployeeBayNumber(employee.bayNumber);

  if (!hasAssignedWorkspaceSeat(employee)) {
    return {
      label: "Unassigned",
      toneClass: "border-border/60 bg-muted/30 text-muted-foreground",
      isAssigned: false,
    };
  }

  return {
    label: `Seat ${bay}`,
    toneClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    isAssigned: true,
    zoneLabel: `${bay.charAt(0)}-Zone`,
  };
}

export function workforceAnalytics(employees: Employee[], projects: Project[]): WorkforceAnalytics {
  const totalEmployees = employees.length;
  const activeTeams = new Set(employees.map((employee) => employee.team)).size;
  const projectLeads = employees.filter((employee) =>
    DIRECTORY_LEAD_ROLES.has(employee.role),
  ).length;
  const employeesWithoutProjects = employees.filter(
    (employee) => employeeAssignedProjects(employee, projects).length === 0,
  ).length;
  const availableEmployees = employees.filter(
    (employee) => employeeAvailabilityState(employee, projects).label === "Available",
  ).length;
  const activeProjectsAssigned = employees.reduce(
    (sum, employee) => sum + employeeActiveProjects(employee, projects).length,
    0,
  );

  return {
    totalEmployees,
    activeTeams,
    projectLeads,
    employeesWithoutProjects,
    availableEmployees,
    activeProjectsAssigned,
  };
}

export function formatCsvValue(value: string | number | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}


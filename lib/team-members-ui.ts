import { canAssignEmployeeProjects } from "@/lib/permissions";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { isValidSeatId } from "@/lib/seating-layout";
import type { AccessContext } from "@/lib/permissions";
import type { Employee, EmployeeDetail, Project } from "@/types";

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
  teamLeads: number;
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

export function employeeCompletedProjects(
  employee: Pick<Employee, "id" | "team">,
  projects: Project[],
) {
  return employeeAssignedProjects(employee, projects).filter(
    (project) => project.status === "Completed",
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

export function employeeCompletionRate(
  employee: Pick<Employee, "id" | "team">,
  projects: Project[],
) {
  const assigned = employeeAssignedProjects(employee, projects);
  if (assigned.length === 0) return 0;
  const completed = assigned.filter((project) => project.status === "Completed").length;
  return Math.round((completed / assigned.length) * 100);
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
  const teamLeads = employees.filter((employee) => employee.role === "Team Lead").length;
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
    teamLeads,
    employeesWithoutProjects,
    availableEmployees,
    activeProjectsAssigned,
  };
}

export function employeeActivityFeed(
  employee: EmployeeDetail,
  projects: Project[],
) {
  const assigned = employeeAssignedProjects(employee, projects);
  const items = [
    ...assigned.map((project) => ({
      id: `project-${project.id}`,
      title:
        project.status === "Completed"
          ? `Completed work in ${project.name}`
          : `Assigned to ${project.name}`,
      description:
        project.status === "Completed"
          ? "Delivery milestone closed in the current portfolio."
          : "Active assignment visible in the current workspace.",
      date: project.status === "Completed" ? project.lastDate : project.assignedDate,
      tone:
        project.status === "Completed"
          ? ("success" as const)
          : project.status === "In Progress"
            ? ("default" as const)
            : ("warning" as const),
    })),
  ];

  if (employee.directory?.joinedDate) {
    items.push({
      id: `joined-${employee.id}`,
      title: "Joined the workspace",
      description: `Employee profile created for ${employee.team}.`,
      date: employee.directory.joinedDate,
      tone: "default" as const,
    });
  }

  if (hasAssignedWorkspaceSeat(employee)) {
    const bay = normalizeEmployeeBayNumber(employee.bayNumber);
    items.push({
      id: `seat-${employee.id}`,
      title: "Workspace seat assigned",
      description: `Current workspace seat: Seat ${bay}.`,
      date: employee.directory?.joinedDate ?? new Date().toISOString().slice(0, 10),
      tone: "default" as const,
    });
  }

  return items
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);
}

export function formatCsvValue(value: string | number | undefined) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}


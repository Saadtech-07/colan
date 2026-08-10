import type { AuthUser, Employee, Project, TeamName } from "@/types";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { teamTabLabel } from "@/lib/team-utils";

export type DashboardScope = "company" | "team" | "personal";

export type DashboardKpi = {
  id: "totalProjects" | "activeProjects" | "totalEmployees" | "delayedProjects";
  label: string;
  value: number;
  description: string;
};

export type ProjectStatusStat = {
  name: "Yet To Start" | "In Progress" | "Completed" | "Delayed";
  value: number;
  color: string;
};

export type EmployeeDistributionStat = {
  name: TeamName;
  label: string;
  value: number;
  percentage: number;
  color: string;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  tone: "default" | "success" | "warning";
  kind: "project" | "employee";
};

export type DashboardDeadlineItem = {
  projectId: string;
  projectName: string;
  slug: string;
  lastDate: string;
  teams: TeamName[];
  status: Project["status"];
  tone: "danger" | "warning" | "default";
  label: string;
  relativeLabel: string;
};

export type DashboardOverview = {
  scope: DashboardScope;
  scopeLabel: string;
  greetingName: string;
  kpis: DashboardKpi[];
  projectStats: ProjectStatusStat[];
  totalProjects: number;
  employeeDistribution: EmployeeDistributionStat[];
  totalEmployeesInDistribution: number;
  recentActivity: DashboardActivityItem[];
  upcomingDeadlines: DashboardDeadlineItem[];
};

const TEAM_SCOPE_HINTS = ["manager", "lead", "scrum", "qa", "hr", "co-lead"] as const;

const CHART_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#3b82f6",
] as const;

const STATUS_COLORS: Record<ProjectStatusStat["name"], string> = {
  "Yet To Start": "#94a3b8",
  "In Progress": "#6366f1",
  Completed: "#10b981",
  Delayed: "#f59e0b",
};

type AccessLike = {
  role: string;
  definition: { label: string };
  canManageProjects?: boolean;
  canWriteEmployees?: boolean;
  canAssignSeating?: boolean;
  seesAllTeams?: boolean;
} | null;

export function parseLocalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatShortDate(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Relative label for calendar dates (project deadlines / joined dates). */
export function formatRelativeCalendarDate(value: string, today = new Date()) {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  const delta = Math.round(
    (startOfDay(parsed).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1 && delta <= 7) return `In ${delta} days`;
  if (delta < -1 && delta >= -7) return `${Math.abs(delta)} days ago`;
  return formatShortDate(value);
}

export function isProjectDelayed(project: Project, today: Date) {
  if (project.status === "Completed") return false;
  const lastDate = parseLocalDate(project.lastDate);
  if (!lastDate) return false;
  return lastDate < startOfDay(today);
}

function isWithinLastWeek(value: string, today: Date) {
  const parsed = parseLocalDate(value);
  if (!parsed) return false;
  const windowStart = startOfDay(today);
  windowStart.setDate(windowStart.getDate() - 7);
  const activityDay = startOfDay(parsed);
  return activityDay >= windowStart && activityDay <= startOfDay(today);
}

export function resolveDashboardScope(
  user: AuthUser | null,
  access: AccessLike,
): DashboardScope {
  if (!user || !access) return "personal";
  const roleDescriptor = `${access.role} ${access.definition.label}`.toLowerCase();
  if (access.role.toLowerCase() === "admin") return "company";
  if (
    user.team &&
    (access.canManageProjects ||
      access.canWriteEmployees ||
      access.canAssignSeating ||
      TEAM_SCOPE_HINTS.some((hint) => roleDescriptor.includes(hint)))
  ) {
    return "team";
  }
  if (access.seesAllTeams && !user.team) return "company";
  return "personal";
}

export function scopeLabel(scope: DashboardScope, team?: string | null) {
  if (scope === "company") return "Company-wide";
  if (scope === "team") return team ? `${teamTabLabel(team)} team` : "Team";
  return "Personal";
}

export function findEmployeeForUser(employees: Employee[], user: AuthUser | null) {
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return (
    employees.find(
      (employee) => employee.directory?.workEmail?.trim().toLowerCase() === email,
    ) ??
    employees.find(
      (employee) =>
        employee.name.trim().toLowerCase() === user.name.trim().toLowerCase() &&
        (!user.team || employee.team === user.team),
    ) ??
    null
  );
}

function deadlineRelativeLabel(lastDate: string, today: Date) {
  const parsed = parseLocalDate(lastDate);
  if (!parsed) return formatShortDate(lastDate);
  const delta = Math.round(
    (startOfDay(parsed).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta < 0) {
    const days = Math.abs(delta);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  if (delta <= 7) return `Due in ${delta} days`;
  return formatShortDate(lastDate);
}

function deadlineToneLabel(project: Project, today: Date) {
  if (isProjectDelayed(project, today)) {
    return { tone: "danger" as const, label: "Overdue" };
  }
  const lastDate = parseLocalDate(project.lastDate);
  if (!lastDate) return { tone: "default" as const, label: "Upcoming" };
  const delta = Math.round(
    (startOfDay(lastDate).getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta === 0) return { tone: "warning" as const, label: "Due today" };
  if (delta === 1) return { tone: "warning" as const, label: "Due tomorrow" };
  if (delta <= 7) return { tone: "warning" as const, label: "This week" };
  return { tone: "default" as const, label: "Upcoming" };
}

export function buildDashboardOverview(args: {
  user: AuthUser | null;
  access: AccessLike;
  projects: Project[];
  employees: Employee[];
  teamNames: TeamName[];
  today?: Date;
}): DashboardOverview {
  const today = args.today ?? new Date();
  const scope = resolveDashboardScope(args.user, args.access);
  const currentEmployee = findEmployeeForUser(args.employees, args.user);

  const scopedProjects = (() => {
    if (!args.user || !args.access) return [] as Project[];
    if (scope === "company") return args.projects;
    if (scope === "team") {
      return args.user.team
        ? args.projects.filter((project) => project.teams.includes(args.user!.team!))
        : args.projects;
    }
    if (!currentEmployee) return [];
    return getProjectsForEmployee(currentEmployee.id, args.projects).filter((project) =>
      args.user?.team ? project.teams.includes(args.user.team) : true,
    );
  })();

  const scopedEmployees = (() => {
    if (scope === "company") return args.employees;
    if (scope === "team") {
      return args.user?.team
        ? args.employees.filter((employee) => employee.team === args.user!.team)
        : args.employees;
    }
    return currentEmployee ? [currentEmployee] : [];
  })();

  const delayed = scopedProjects.filter((project) => isProjectDelayed(project, today));
  const completed = scopedProjects.filter((project) => project.status === "Completed");
  const inProgress = scopedProjects.filter(
    (project) => project.status === "In Progress" && !isProjectDelayed(project, today),
  );
  const yetToStart = scopedProjects.filter(
    (project) => project.status === "Yet To Start" && !isProjectDelayed(project, today),
  );
  const activeProjects = scopedProjects.filter((project) => project.status !== "Completed");

  const projectStats: ProjectStatusStat[] = [
    { name: "Yet To Start", value: yetToStart.length, color: STATUS_COLORS["Yet To Start"] },
    { name: "In Progress", value: inProgress.length, color: STATUS_COLORS["In Progress"] },
    { name: "Completed", value: completed.length, color: STATUS_COLORS.Completed },
    { name: "Delayed", value: delayed.length, color: STATUS_COLORS.Delayed },
  ];

  const distributionSource =
    scope === "personal" ? [] : scope === "company" ? args.employees : scopedEmployees;
  const totalEmployeesInDistribution = distributionSource.length;
  const teamCounts = new Map<TeamName, number>();
  for (const employee of distributionSource) {
    teamCounts.set(employee.team, (teamCounts.get(employee.team) ?? 0) + 1);
  }
  const orderedTeams = [
    ...args.teamNames.filter((team) => teamCounts.has(team)),
    ...Array.from(teamCounts.keys()).filter((team) => !args.teamNames.includes(team)),
  ];
  const employeeDistribution: EmployeeDistributionStat[] =
    totalEmployeesInDistribution === 0
      ? []
      : orderedTeams.map((team, index) => {
          const count = teamCounts.get(team) ?? 0;
          return {
            name: team,
            label: teamTabLabel(team),
            value: count,
            percentage: Math.round((count / totalEmployeesInDistribution) * 100),
            color: CHART_COLORS[index % CHART_COLORS.length],
          };
        });

  const activity: DashboardActivityItem[] = [];
  for (const project of scopedProjects) {
    const teamLabel = project.teams.map(teamTabLabel).join(" + ") || "Workspace";
    if (project.status === "Completed") {
      activity.push({
        id: `complete-${project.id}`,
        title: `${project.name} marked completed`,
        description: `${teamLabel} closed this delivery milestone.`,
        date: project.lastDate,
        tone: "success",
        kind: "project",
      });
      continue;
    }
    if (isProjectDelayed(project, today)) {
      activity.push({
        id: `delay-${project.id}`,
        title: `${project.name} needs attention`,
        description: `Deadline passed for ${teamLabel}.`,
        date: project.lastDate,
        tone: "warning",
        kind: "project",
      });
      continue;
    }
    activity.push({
      id: `start-${project.id}`,
      title:
        project.status === "Yet To Start"
          ? `${project.name} added to the backlog`
          : `${project.name} moved into delivery`,
      description:
        project.status === "Yet To Start"
          ? `${teamLabel} is preparing kickoff.`
          : `${teamLabel} is actively delivering.`,
      date: project.assignedDate,
      tone: "default",
      kind: "project",
    });
  }

  const activityEmployees = scope === "company" ? args.employees : scopedEmployees;
  for (const employee of activityEmployees) {
    const joinedDate = employee.directory?.joinedDate;
    if (!joinedDate) continue;
    activity.push({
      id: `employee-${employee.id}`,
      title: `${employee.name} joined ${teamTabLabel(employee.team)}`,
      description: `${employee.role} profile is visible in the directory.`,
      date: joinedDate,
      tone: "default",
      kind: "employee",
    });
  }

  const recentActivity = activity
    .filter((item) => isWithinLastWeek(item.date, today))
    .sort((a, b) => {
      const left = parseLocalDate(a.date)?.getTime() ?? 0;
      const right = parseLocalDate(b.date)?.getTime() ?? 0;
      return right - left;
    })
    .slice(0, 10);

  const upcomingDeadlines = scopedProjects
    .filter((project) => project.status !== "Completed")
    .sort((a, b) => {
      const left = parseLocalDate(a.lastDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const right = parseLocalDate(b.lastDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .slice(0, 8)
    .map((project) => {
      const { tone, label } = deadlineToneLabel(project, today);
      return {
        projectId: project.id,
        projectName: project.name,
        slug: project.slug,
        lastDate: project.lastDate,
        teams: project.teams,
        status: project.status,
        tone,
        label,
        relativeLabel: deadlineRelativeLabel(project.lastDate, today),
      };
    });

  const employeeCountForKpi =
    scope === "personal" ? scopedEmployees.length : scopedEmployees.length;

  const kpis: DashboardKpi[] = [
    {
      id: "totalProjects",
      label: "Total Projects",
      value: scopedProjects.length,
      description:
        scope === "personal" ? "Assigned to you" : "In current workspace scope",
    },
    {
      id: "activeProjects",
      label: "Active Projects",
      value: activeProjects.length,
      description: "Not completed",
    },
    {
      id: "totalEmployees",
      label: scope === "personal" ? "Your Profile" : "Total Employees",
      value: employeeCountForKpi,
      description:
        scope === "personal"
          ? "Linked employee record"
          : scope === "team"
            ? "On your team"
            : "Across the company",
    },
    {
      id: "delayedProjects",
      label: "Delayed Projects",
      value: delayed.length,
      description: delayed.length > 0 ? "Past deadline" : "None overdue",
    },
  ];

  return {
    scope,
    scopeLabel: scopeLabel(scope, args.user?.team),
    greetingName: args.user?.name?.trim() || "there",
    kpis,
    projectStats,
    totalProjects: scopedProjects.length,
    employeeDistribution,
    totalEmployeesInDistribution,
    recentActivity,
    upcomingDeadlines,
  };
}

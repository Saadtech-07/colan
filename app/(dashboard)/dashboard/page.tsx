"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Cloud,
  Code2,
  FolderKanban,
  Layers3,
  ListTodo,
  Palette,
  Server,
  ShieldAlert,
  Sparkles,
  Users2,
  Workflow,
  Wrench,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";
import type { AuthUser, Employee, Project, TeamName } from "@/types";

type DashboardScope = "company" | "team" | "personal";

type SummaryCardData = {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  toneClass: string;
};

type StatusDatum = {
  name: string;
  value: number;
  color: string;
};

type TeamDistributionDatum = {
  name: string;
  value: number;
  percentage: number;
  color: string;
};

type TeamPerformanceDatum = {
  team: TeamName;
  total: number;
  completed: number;
  active: number;
  delayed: number;
  headcount: number;
  completionPercentage: number;
  members: Employee[];
};

type ActivityItem = {
  id: string;
  title: string;
  description: string;
  date: string;
  tone: "default" | "success" | "warning";
  icon: React.ComponentType<{ className?: string }>;
};

type DeadlineItem = {
  project: Project;
  tone: "default" | "warning" | "danger";
  label: string;
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

function parseLocalDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatShortDate(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function relativeDateLabel(value: string, today: Date) {
  const parsed = parseLocalDate(value);
  if (!parsed) return value;
  const delta = Math.round(
    (parsed.getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta === 0) return "Today";
  if (delta === 1) return "Tomorrow";
  if (delta === -1) return "Yesterday";
  if (delta > 1) return `In ${delta} days`;
  return `${Math.abs(delta)} days ago`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfWindow(date: Date, daysAhead: number) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + daysAhead);
  return next;
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

function isProjectDelayed(project: Project, today: Date) {
  if (project.status === "Completed") return false;
  const lastDate = parseLocalDate(project.lastDate);
  if (!lastDate) return false;
  return lastDate < startOfDay(today);
}

function isDeadlineWithinWeek(project: Project, today: Date) {
  if (project.status === "Completed") return false;
  const lastDate = parseLocalDate(project.lastDate);
  if (!lastDate) return false;
  return (
    lastDate >= startOfDay(today) &&
    lastDate <= endOfWindow(today, 7)
  );
}

function resolveDashboardScope(
  user: AuthUser | null,
  access: ReturnType<typeof useAppState>["access"],
) {
  if (!user || !access) return "personal" as DashboardScope;
  const roleDescriptor = `${access.role} ${access.definition.label}`.toLowerCase();
  if (access.role.toLowerCase() === "admin") return "company" as DashboardScope;
  if (
    user.team &&
    (access.canManageProjects ||
      access.canWriteEmployees ||
      access.canAssignSeating ||
      TEAM_SCOPE_HINTS.some((hint) => roleDescriptor.includes(hint)))
  ) {
    return "team" as DashboardScope;
  }
  if (access.seesAllTeams && !user.team) return "company" as DashboardScope;
  return "personal" as DashboardScope;
}

function findEmployeeForUser(employees: Employee[], user: AuthUser | null) {
  if (!user) return null;
  const email = user.email.trim().toLowerCase();
  return (
    employees.find(
      (employee) =>
        employee.directory?.workEmail?.trim().toLowerCase() === email,
    ) ??
    employees.find(
      (employee) =>
        employee.name.trim().toLowerCase() === user.name.trim().toLowerCase() &&
        (!user.team || employee.team === user.team),
    ) ??
    null
  );
}

function projectStatusBadge(project: Project, today: Date) {
  if (isProjectDelayed(project, today)) {
    return {
      label: "Delayed",
      variant: "warning" as const,
    };
  }
  if (project.status === "Completed") {
    return {
      label: "Completed",
      variant: "success" as const,
    };
  }
  if (project.status === "In Progress") {
    return {
      label: "In Progress",
      variant: "default" as const,
    };
  }
  return {
    label: "Yet To Start",
    variant: "outline" as const,
  };
}

function projectProgressValue(project: Project, today: Date) {
  if (isProjectDelayed(project, today)) return 36;
  if (project.status === "Completed") return 100;
  if (project.status === "In Progress") return 68;
  return 18;
}

function renderTeamIcon(team: string, className?: string) {
  const normalized = team.toLowerCase();
  if (normalized.includes("react") || normalized.includes("next")) {
    return <Code2 className={className} />;
  }
  if (normalized.includes("node") || normalized.includes("java") || normalized.includes("python")) {
    return <Server className={className} />;
  }
  if (normalized.includes("ui") || normalized.includes("design")) {
    return <Palette className={className} />;
  }
  if (normalized.includes("devops")) return <Cloud className={className} />;
  if (normalized.includes("test")) return <Wrench className={className} />;
  return <Layers3 className={className} />;
}

function toneForActivity(item: ActivityItem["tone"]) {
  if (item === "success") return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300";
  if (item === "warning") return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  return "bg-primary/10 text-primary";
}

function buildActivityFeed(
  projects: Project[],
  employees: Employee[],
  today: Date,
) {
  const activity: ActivityItem[] = [];

  for (const project of projects) {
    const teamLabel = project.teams.map(teamTabLabel).join(" + ");
    if (project.status === "Completed") {
      activity.push({
        id: `complete-${project.id}`,
        title: `${project.name} marked completed`,
        description: `${teamLabel} closed this delivery milestone.`,
        date: project.lastDate,
        tone: "success",
        icon: CheckCircle2,
      });
      continue;
    }

    if (isProjectDelayed(project, today)) {
      activity.push({
        id: `delay-${project.id}`,
        title: `${project.name} needs attention`,
        description: `Deadline passed for ${teamLabel}. Review the delivery plan.`,
        date: project.lastDate,
        tone: "warning",
        icon: ShieldAlert,
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
          ? `${teamLabel} is preparing kickoff sequencing.`
          : `${teamLabel} is actively working against the current timeline.`,
      date: project.assignedDate,
      tone: "default",
      icon: project.status === "Yet To Start" ? CircleDashed : BriefcaseBusiness,
    });
  }

  for (const employee of employees) {
    const joinedDate = employee.directory?.joinedDate;
    if (!joinedDate) continue;
    activity.push({
      id: `employee-${employee.id}`,
      title: `${employee.name} joined ${teamTabLabel(employee.team)}`,
      description: `${employee.role} profile is visible in the workspace directory.`,
      date: joinedDate,
      tone: "default",
      icon: Users2,
    });
  }

  return activity
    .sort((a, b) => {
      const left = parseLocalDate(a.date)?.getTime() ?? 0;
      const right = parseLocalDate(b.date)?.getTime() ?? 0;
      return right - left;
    })
    .slice(0, 10);
}

function buildDeadlines(projects: Project[], today: Date) {
  return projects
    .filter((project) => project.status !== "Completed")
    .sort((a, b) => {
      const left = parseLocalDate(a.lastDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const right = parseLocalDate(b.lastDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .map((project) => {
      if (isProjectDelayed(project, today)) {
        return {
          project,
          tone: "danger" as const,
          label: "Delayed",
        };
      }
      if (isDeadlineWithinWeek(project, today)) {
        return {
          project,
          tone: "warning" as const,
          label: "This week",
        };
      }
      return {
        project,
        tone: "default" as const,
        label: "Upcoming",
      };
    })
    .slice(0, 8);
}

function buildTeamPerformance(
  teams: TeamName[],
  projects: Project[],
  employees: Employee[],
  today: Date,
) {
  return teams
    .map((team) => {
      const teamProjects = projects.filter((project) => project.teams.includes(team));
      const members = employees.filter((employee) => employee.team === team);
      const completed = teamProjects.filter((project) => project.status === "Completed").length;
      const active = teamProjects.filter((project) => project.status !== "Completed").length;
      const delayed = teamProjects.filter((project) => isProjectDelayed(project, today)).length;
      return {
        team,
        total: teamProjects.length,
        completed,
        active,
        delayed,
        headcount: members.length,
        completionPercentage:
          teamProjects.length === 0 ? 0 : Math.round((completed / teamProjects.length) * 100),
        members: members.slice(0, 4),
      } satisfies TeamPerformanceDatum;
    })
    .filter((entry) => entry.total > 0 || entry.headcount > 0)
    .sort((a, b) => b.completionPercentage - a.completionPercentage);
}

function toneBadgeClass(tone: DeadlineItem["tone"]) {
  if (tone === "danger") {
    return "border-transparent bg-destructive/10 text-destructive";
  }
  if (tone === "warning") {
    return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
  return "border-transparent bg-primary/10 text-primary";
}

function buildSummaryCards(args: {
  scope: DashboardScope;
  projects: Project[];
  employees: Employee[];
  deadlinesThisWeek: number;
  delayedCount: number;
  teams: TeamName[];
}) {
  const activeProjects = args.projects.filter((project) => project.status !== "Completed").length;
  const completedProjects = args.projects.filter((project) => project.status === "Completed").length;
  const pendingTasks =
    args.scope === "personal"
      ? activeProjects
      : args.projects.reduce(
          (sum, project) =>
            project.status === "Completed" ? sum : sum + Math.max(project.memberIds.length, 1),
          0,
        );

  const cards: SummaryCardData[] = [
    {
      title: args.scope === "personal" ? "Assigned Projects" : "Active Projects",
      value: String(activeProjects),
      hint:
        args.scope === "company"
          ? "Open delivery initiatives"
          : args.scope === "team"
            ? "Open work in your squad"
            : "Projects currently on your plate",
      icon: BriefcaseBusiness,
      toneClass:
        "from-indigo-500/12 via-indigo-500/6 to-transparent text-indigo-600 dark:text-indigo-300",
    },
    {
      title: "Completed Projects",
      value: String(completedProjects),
      hint: "Closed in the current dashboard scope",
      icon: CheckCircle2,
      toneClass:
        "from-emerald-500/12 via-emerald-500/6 to-transparent text-emerald-600 dark:text-emerald-300",
    },
    {
      title: "Pending Tasks",
      value: String(pendingTasks),
      hint:
        args.scope === "personal"
          ? "Outstanding assigned work"
          : "Open delivery assignments",
      icon: ListTodo,
      toneClass:
        "from-cyan-500/12 via-cyan-500/6 to-transparent text-cyan-600 dark:text-cyan-300",
    },
    {
      title: "Deadlines This Week",
      value: String(args.deadlinesThisWeek),
      hint: args.delayedCount > 0 ? `${args.delayedCount} delayed projects flagged` : "No delayed deadlines in scope",
      icon: CalendarClock,
      toneClass:
        "from-amber-500/12 via-amber-500/6 to-transparent text-amber-700 dark:text-amber-300",
    },
  ];

  if (args.scope !== "personal") {
    cards.splice(2, 0, {
      title: "Active Teams",
      value: String(args.teams.length),
      hint:
        args.scope === "company"
          ? "Squads engaged this cycle"
          : "Team spaces in your current view",
      icon: Workflow,
      toneClass:
        "from-violet-500/12 via-violet-500/6 to-transparent text-violet-600 dark:text-violet-300",
    });

    cards.push({
      title: "Total Employees",
      value: String(args.employees.length),
      hint:
        args.scope === "company"
          ? "Visible workspace headcount"
          : "People in your assigned squad",
      icon: Users2,
      toneClass:
        "from-slate-500/12 via-slate-500/6 to-transparent text-slate-600 dark:text-slate-300",
    });
  }

  return cards;
}

export default function DashboardPage() {
  const {
    projects,
    access,
    user,
    employees,
    dataError,
    dataSummary,
    teamNames,
    dataLoading,
  } = useAppState();

  const today = React.useMemo(() => new Date(), []);
  const currentEmployee = React.useMemo(
    () => findEmployeeForUser(employees, user),
    [employees, user],
  );
  const dashboardScope = React.useMemo(
    () => resolveDashboardScope(user, access),
    [access, user],
  );

  const scopedProjects = React.useMemo(() => {
    if (!user || !access) return [];
    if (dashboardScope === "company") return projects;
    if (dashboardScope === "team") {
      return user.team ? projects.filter((project) => project.teams.includes(user.team!)) : projects;
    }
    if (!currentEmployee) return [];
    return getProjectsForEmployee(currentEmployee.id, projects).filter((project) =>
      user.team ? project.teams.includes(user.team) : true,
    );
  }, [access, currentEmployee, dashboardScope, projects, user]);

  const scopedEmployees = React.useMemo(() => {
    if (dashboardScope === "company") return employees;
    if (dashboardScope === "team") {
      return user?.team ? employees.filter((employee) => employee.team === user.team) : employees;
    }
    return currentEmployee ? [currentEmployee] : [];
  }, [currentEmployee, dashboardScope, employees, user]);

  const teamsInScope = React.useMemo(() => {
    const discoveredTeams = new Set<TeamName>();
    for (const project of scopedProjects) {
      for (const team of project.teams) discoveredTeams.add(team);
    }

    if (dashboardScope === "personal") {
      if (currentEmployee?.team) return [currentEmployee.team];
      if (user?.team) return [user.team];
      return [];
    }

    const ordered = teamNames.filter((team) => discoveredTeams.has(team));
    if (ordered.length > 0) return ordered;
    if (dashboardScope === "team" && user?.team) return [user.team];
    return Array.from(discoveredTeams);
  }, [currentEmployee, dashboardScope, scopedProjects, teamNames, user]);

  const statusData = React.useMemo<StatusDatum[]>(() => {
    const delayed = scopedProjects.filter((project) => isProjectDelayed(project, today)).length;
    const completed = scopedProjects.filter((project) => project.status === "Completed").length;
    const inProgress = scopedProjects.filter(
      (project) => project.status === "In Progress" && !isProjectDelayed(project, today),
    ).length;
    const yetToStart = scopedProjects.filter(
      (project) => project.status === "Yet To Start" && !isProjectDelayed(project, today),
    ).length;

    return [
      { name: "Yet To Start", value: yetToStart, color: "#94a3b8" },
      { name: "In Progress", value: inProgress, color: "#6366f1" },
      { name: "Completed", value: completed, color: "#10b981" },
      { name: "Delayed", value: delayed, color: "#f59e0b" },
    ];
  }, [scopedProjects, today]);

  const delayedProjects = React.useMemo(
    () => scopedProjects.filter((project) => isProjectDelayed(project, today)),
    [scopedProjects, today],
  );

  const deadlinesThisWeek = React.useMemo(
    () => scopedProjects.filter((project) => isDeadlineWithinWeek(project, today)),
    [scopedProjects, today],
  );

  const summaryCards = React.useMemo(
    () =>
      buildSummaryCards({
        scope: dashboardScope,
        projects: scopedProjects,
        employees: scopedEmployees,
        deadlinesThisWeek: deadlinesThisWeek.length,
        delayedCount: delayedProjects.length,
        teams: teamsInScope,
      }),
    [dashboardScope, deadlinesThisWeek.length, delayedProjects.length, scopedEmployees, scopedProjects, teamsInScope],
  );

  const teamDistribution = React.useMemo<TeamDistributionDatum[]>(() => {
    if (dashboardScope === "personal") return [];
    const baseEmployees = dashboardScope === "company" ? employees : scopedEmployees;
    const total = baseEmployees.length;
    if (total === 0) return [];

    return teamsInScope
      .map((team, index) => {
        const count = baseEmployees.filter((employee) => employee.team === team).length;
        return {
          name: team,
          value: count,
          percentage: total === 0 ? 0 : Math.round((count / total) * 100),
          color: CHART_COLORS[index % CHART_COLORS.length],
        };
      })
      .filter((entry) => entry.value > 0);
  }, [dashboardScope, employees, scopedEmployees, teamsInScope]);

  const teamPerformance = React.useMemo(
    () => buildTeamPerformance(teamsInScope, scopedProjects, employees, today),
    [employees, scopedProjects, teamsInScope, today],
  );

  const activityItems = React.useMemo(
    () => buildActivityFeed(scopedProjects, dashboardScope === "company" ? employees : scopedEmployees, today),
    [dashboardScope, employees, scopedEmployees, scopedProjects, today],
  );

  const deadlineItems = React.useMemo(
    () => buildDeadlines(scopedProjects, today),
    [scopedProjects, today],
  );

  const projectsByTeam = React.useMemo(
    () =>
      teamsInScope.reduce(
        (acc, team) => {
          acc[team] = scopedProjects.filter((project) => project.teams.includes(team));
          return acc;
        },
        {} as Record<TeamName, Project[]>,
      ),
    [scopedProjects, teamsInScope],
  );

  const roleLabel = access?.definition.label ?? user?.appRole ?? "Workspace";
  const workspaceSubtitle =
    dashboardScope === "company"
      ? "Here's your workspace performance overview."
      : dashboardScope === "team"
        ? `Here's the latest delivery view for ${teamTabLabel(user?.team ?? "your team")}.`
        : "Here's your personal delivery overview.";

  const showDistributionChart = dashboardScope !== "personal" && teamDistribution.length > 1;
  const isInitialLoading =
    dataLoading && scopedProjects.length === 0 && employees.length === 0 && teamNames.length === 0;

  return (
    <div className="space-y-6">
      <section>
        <div className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/75 p-5 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_30%)]" />
          <div className="relative space-y-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                  {roleLabel} workspace
                </Badge>
                {user?.team && (
                  <Badge variant="outline" className="rounded-full px-3 py-1 font-normal">
                    {teamTabLabel(user.team)}
                  </Badge>
                )}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                  Welcome back, {user?.name ?? "there"}
                </h1>
                <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                  {workspaceSubtitle}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                  <BriefcaseBusiness className="h-4 w-4 text-primary" />
                  {scopedProjects.length} visible projects
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                  <CalendarClock className="h-4 w-4 text-amber-500" />
                  {deadlinesThisWeek.length} due this week
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5">
                  <ShieldAlert className="h-4 w-4 text-rose-500" />
                  {delayedProjects.length} delayed
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {dataSummary?.backend === "memory" && (
        <AlertStrip
          tone="warning"
          title="In-memory data"
          description={`${dataSummary.reason} Lists reset when the server restarts.`}
        />
      )}
      {dataSummary?.backend === "error" && (
        <AlertStrip
          tone="danger"
          title="MongoDB connection failed."
          description={dataSummary.message}
        />
      )}
      {dataError && (
        <AlertStrip
          tone="danger"
          title="Workspace data error"
          description={
            <>
              {dataError}{" "}
              <span className="text-muted-foreground">
                Check API routes and optional <code className="text-xs">MONGODB_URI</code>.
              </span>
            </>
          }
        />
      )}

      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
            {summaryCards.map((card) => (
              <SummaryCard key={card.title} {...card} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    <FolderKanban className="h-3.5 w-3.5" />
                    Analytics
                  </div>
                  <CardTitle className="text-xl">Project status analytics</CardTitle>
                  <CardDescription>
                    Live portfolio mix for your current dashboard scope.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 font-normal">
                  {dashboardScope === "company"
                    ? "Company-wide"
                    : dashboardScope === "team"
                      ? "Assigned team"
                      : "Personal"}
                </Badge>
              </CardHeader>
              <CardContent className="p-6">
                {scopedProjects.length === 0 ? (
                  <EmptySectionState
                    icon={FolderKanban}
                    title="No project analytics yet"
                    description="Projects assigned to this dashboard scope will appear here automatically."
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="h-[320px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData} barGap={12}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/70" vertical={false} />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                          <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                          <Tooltip
                            cursor={{ fill: "rgba(99, 102, 241, 0.08)" }}
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const datum = payload[0]?.payload as StatusDatum;
                              return (
                                <div className="rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-xl backdrop-blur">
                                  <p className="text-sm font-semibold text-foreground">{datum.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {datum.value} project{datum.value === 1 ? "" : "s"}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey="value" radius={[12, 12, 6, 6]} animationDuration={800}>
                            {statusData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {statusData.map((entry) => (
                        <div
                          key={entry.name}
                          className="rounded-2xl border border-border/60 bg-muted/25 px-4 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm font-medium text-foreground">{entry.name}</span>
                          </div>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                            {entry.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {showDistributionChart ? (
              <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
                <CardHeader className="border-b border-border/60 pb-4">
                  <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    <Users2 className="h-3.5 w-3.5" />
                    Distribution
                  </div>
                  <CardTitle className="text-xl">Team employee distribution</CardTitle>
                  <CardDescription>
                    Headcount split across the teams visible in this workspace view.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={teamDistribution}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={92}
                            paddingAngle={3}
                            animationDuration={800}
                          >
                            {teamDistribution.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const datum = payload[0]?.payload as TeamDistributionDatum;
                              return (
                                <div className="rounded-2xl border border-border/70 bg-background/95 px-3 py-2 shadow-xl backdrop-blur">
                                  <p className="text-sm font-semibold text-foreground">{datum.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {datum.value} employee{datum.value === 1 ? "" : "s"} · {datum.percentage}%
                                  </p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="space-y-3">
                      {teamDistribution.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/25 px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            <div>
                              <p className="text-sm font-medium text-foreground">{entry.name}</p>
                              <p className="text-xs text-muted-foreground">{entry.percentage}% of visible headcount</p>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{entry.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <TeamSpotlightCard
                scope={dashboardScope}
                team={teamsInScope[0]}
                employees={dashboardScope === "personal" ? scopedEmployees : scopedEmployees.slice(0, 6)}
                activeProjects={scopedProjects.filter((project) => project.status !== "Completed").length}
                delayedProjects={delayedProjects.length}
                dueSoon={deadlinesThisWeek.length}
              />
            )}
          </section>

          {dashboardScope !== "personal" && (
            <section className="space-y-4">
              <SectionHeader
                eyebrow="Delivery health"
                title="Team performance"
                description="Completion percentage, active workload, and squad-level execution metrics."
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {teamPerformance.length === 0 ? (
                  <Card className="border-dashed border-border/70 bg-background/60 xl:col-span-2">
                    <CardContent className="flex min-h-[180px] items-center justify-center p-6">
                      <EmptySectionState
                        icon={Workflow}
                        title="No team performance data yet"
                        description="Team metrics will appear as projects and members are added."
                      />
                    </CardContent>
                  </Card>
                ) : (
                  teamPerformance.map((item) => (
                    <TeamPerformanceCard key={item.team} item={item} />
                  ))
                )}
              </div>
            </section>
          )}

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
              <CardHeader className="border-b border-border/60 pb-4">
                <SectionHeader
                  eyebrow="Activity"
                  title="Recent activity"
                  description={
                    dashboardScope === "personal"
                      ? "Recent updates related to your assigned work."
                      : "Latest delivery and roster activity across this dashboard scope."
                  }
                />
              </CardHeader>
              <CardContent className="p-0">
                {activityItems.length === 0 ? (
                  <div className="p-6">
                    <EmptySectionState
                      icon={Sparkles}
                      title="No recent activity yet"
                      description="Activity snapshots will appear as project timelines and employee updates are available."
                    />
                  </div>
                ) : (
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-0 p-6">
                      {activityItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.id} className="relative flex gap-4 pb-5">
                            {index < activityItems.length - 1 && (
                              <span className="absolute left-[1.15rem] top-10 h-[calc(100%-1.25rem)] w-px bg-border/70" />
                            )}
                            <div
                              className={cn(
                                "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                                toneForActivity(item.tone),
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {relativeDateLabel(item.date, today)}
                                </p>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
              <CardHeader className="border-b border-border/60 pb-4">
                <SectionHeader
                  eyebrow="Planning"
                  title="Upcoming deadlines"
                  description="Priority deadlines, sprint risk, and projects that need follow-up."
                />
              </CardHeader>
              <CardContent className="p-0">
                {deadlineItems.length === 0 ? (
                  <div className="p-6">
                    <EmptySectionState
                      icon={CalendarClock}
                      title="No upcoming deadlines"
                      description="Open project deadlines will appear here automatically."
                    />
                  </div>
                ) : (
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-3 p-6">
                      {deadlineItems.map((item) => (
                        <div
                          key={item.project.id}
                          className="rounded-2xl border border-border/60 bg-muted/20 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.project.name}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {item.project.teams.map(teamTabLabel).join(" + ")}
                              </p>
                            </div>
                            <div className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", toneBadgeClass(item.tone))}>
                              {item.label}
                            </div>
                          </div>
                          <Separator className="my-3" />
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Due {formatShortDate(item.project.lastDate)}</span>
                            <Badge variant={projectStatusBadge(item.project, today).variant}>
                              {projectStatusBadge(item.project, today).label}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-4">
            <SectionHeader
              eyebrow={dashboardScope === "personal" ? "Assigned work" : "Portfolio"}
              title={dashboardScope === "personal" ? "Assigned projects" : "Team-based projects"}
              description={
                dashboardScope === "personal"
                  ? "Your current project assignments with timeline and status visibility."
                  : "Redesigned project cards with stronger hierarchy, status clarity, and team context."
              }
            />

            {dashboardScope === "personal" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {scopedProjects.length === 0 ? (
                  <Card className="border-dashed border-border/70 bg-background/60 xl:col-span-2">
                    <CardContent className="flex min-h-[220px] items-center justify-center p-6">
                      <EmptySectionState
                        icon={FolderKanban}
                        title="No assigned projects yet"
                        description="Once projects are assigned to your profile, they will appear here automatically."
                      />
                    </CardContent>
                  </Card>
                ) : (
                  scopedProjects.map((project) => (
                    <ProjectRowCard key={project.id} project={project} today={today} />
                  ))
                )}
              </div>
            ) : (
              <div className="grid gap-6 2xl:grid-cols-2">
                {teamsInScope.map((team) => (
                  <TeamProjectCard
                    key={team}
                    team={team}
                    projects={projectsByTeam[team] ?? []}
                    employees={employees.filter((employee) => employee.team === team)}
                    today={today}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function AlertStrip({
  tone,
  title,
  description,
}: {
  tone: "warning" | "danger";
  title: string;
  description: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm shadow-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      <span className="font-semibold">{title}</span> {description}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {eyebrow}
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SummaryCard({ title, value, hint, icon: Icon, toneClass }: SummaryCardData) {
  return (
    <Card className="group relative overflow-hidden border-border/70 bg-background/70 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
      <div className={cn("absolute inset-0 bg-gradient-to-br", toneClass)} />
      <CardContent className="relative flex h-full flex-col justify-between p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5 shadow-sm transition-transform duration-300 group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function TeamSpotlightCard({
  scope,
  team,
  employees,
  activeProjects,
  delayedProjects,
  dueSoon,
}: {
  scope: DashboardScope;
  team?: string;
  employees: Employee[];
  activeProjects: number;
  delayedProjects: number;
  dueSoon: number;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <Users2 className="h-3.5 w-3.5" />
          Spotlight
        </div>
        <CardTitle className="text-xl">
          {scope === "personal" ? "Personal focus" : team ? `${teamTabLabel(team)} spotlight` : "Workspace spotlight"}
        </CardTitle>
        <CardDescription>
          {scope === "personal"
            ? "A compact view of your current workload."
            : "Key headcount and delivery signals for the current team view."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <SpotlightMetric title="Active work" value={String(activeProjects)} />
          <SpotlightMetric title="Due soon" value={String(dueSoon)} />
          <SpotlightMetric title="Delayed" value={String(delayedProjects)} />
        </div>

        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Visible members</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No visible team members in this dashboard scope.</p>
            ) : (
              employees.map((employee) => (
                <div key={employee.id} className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-2">
                  <Avatar className="h-8 w-8 ring-1 ring-border/60">
                    <AvatarImage src={employee.imageUrl} alt={employee.name} />
                    <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
                  </Avatar>
                  <div className="max-w-[120px]">
                    <p className="truncate text-xs font-semibold text-foreground">{employee.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{employee.role}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SpotlightMetric({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function TeamPerformanceCard({ item }: { item: TeamPerformanceDatum }) {
  return (
    <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
              {renderTeamIcon(item.team, "h-5 w-5 text-primary")}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{item.team}</p>
              <p className="text-sm text-muted-foreground">
                {item.headcount} member{item.headcount === 1 ? "" : "s"} · {item.total} project{item.total === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {item.completionPercentage}% completed
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion progress</span>
            <span className="font-medium text-foreground">{item.completionPercentage}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${item.completionPercentage}%` }}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <PerformanceMiniStat label="Active workload" value={String(item.active)} />
          <PerformanceMiniStat label="Completed" value={String(item.completed)} />
          <PerformanceMiniStat label="Delayed" value={String(item.delayed)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {item.members.length > 0 ? (
            item.members.map((member) => (
              <div
                key={member.id}
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2.5 py-1.5"
              >
                <Avatar className="h-7 w-7 ring-1 ring-border/60">
                  <AvatarImage src={member.imageUrl} alt={member.name} />
                  <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                </Avatar>
                <span className="max-w-[110px] truncate text-xs font-medium text-foreground">
                  {member.name}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No members in this team yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PerformanceMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function TeamProjectCard({
  team,
  projects,
  employees,
  today,
}: {
  team: TeamName;
  projects: Project[];
  employees: Employee[];
  today: Date;
}) {
  const completed = projects.filter((project) => project.status === "Completed").length;
  const completionPercentage =
    projects.length === 0 ? 0 : Math.round((completed / projects.length) * 100);

  return (
    <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
      <CardHeader className="border-b border-border/60 bg-muted/15 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
              {renderTeamIcon(team, "h-5 w-5 text-primary")}
            </div>
            <div>
              <CardTitle className="text-lg">{team}</CardTitle>
              <CardDescription className="mt-1">
                {projects.length} project{projects.length === 1 ? "" : "s"} · {completionPercentage}% completed
              </CardDescription>
            </div>
          </div>
          <div className="flex -space-x-2">
            {employees.slice(0, 4).map((employee) => (
              <Avatar key={employee.id} className="h-9 w-9 border-2 border-background ring-0">
                <AvatarImage src={employee.imageUrl} alt={employee.name} />
                <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
              </Avatar>
            ))}
            {employees.length > 4 && (
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-semibold text-muted-foreground">
                +{employees.length - 4}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
            No projects yet for this team.
          </div>
        ) : (
          projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="group block rounded-2xl border border-border/60 bg-background/80 p-4 transition-all duration-200 hover:border-primary/25 hover:bg-background hover:shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {project.name}
                    </p>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.teams.map((projectTeam) => (
                      <Badge key={projectTeam} variant="outline" className="rounded-full bg-muted/35 text-[10px] font-medium">
                        {teamTabLabel(projectTeam)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(project.assignedDate)} to {formatShortDate(project.lastDate)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant={projectStatusBadge(project, today).variant}>
                    {projectStatusBadge(project, today).label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {project.memberIds.length} member{project.memberIds.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Delivery progress</span>
                  <span>{projectProgressValue(project, today)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/70">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isProjectDelayed(project, today)
                        ? "bg-gradient-to-r from-amber-500 to-orange-400"
                        : project.status === "Completed"
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-gradient-to-r from-primary via-indigo-500 to-cyan-400",
                    )}
                    style={{ width: `${projectProgressValue(project, today)}%` }}
                  />
                </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ProjectRowCard({ project, today }: { project: Project; today: Date }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-[24px] border border-border/70 bg-background/75 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground transition-colors group-hover:text-primary">
            {project.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.teams.map(teamTabLabel).join(" + ")}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant={projectStatusBadge(project, today).variant}>
          {projectStatusBadge(project, today).label}
        </Badge>
        <Badge variant="outline" className="rounded-full bg-muted/35">
          Due {formatShortDate(project.lastDate)}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span>{projectProgressValue(project, today)}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-indigo-500 to-cyan-400 transition-all duration-500"
            style={{ width: `${projectProgressValue(project, today)}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function EmptySectionState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-36 rounded-[28px] border border-border/60 bg-muted/30" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 rounded-[24px] border border-border/60 bg-muted/30" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-[280px] rounded-[24px] border border-border/60 bg-muted/30" />
        <div className="h-[280px] rounded-[24px] border border-border/60 bg-muted/30" />
      </div>
    </div>
  );
}

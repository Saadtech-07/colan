"use client";

import * as React from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  ListTodo,
  ShieldAlert,
  Sparkles,
  Users2,
  Workflow,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { profileInitials } from "@/lib/profile-image";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getProjectsForEmployee } from "@/lib/project-assignments";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";
import type { AuthUser, Employee, Project, TeamName } from "@/types";
import {
  SectionTitle,
  sectionDescriptionClassName,
  sectionTitleClassName,
} from "@/components/ui/page-typography";

type DashboardScope = "company" | "team" | "personal";

type SummaryCardData = {
  title: string;
  value: string;
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

function isWithinLastWeek(value: string, today: Date) {
  const parsed = parseLocalDate(value);
  if (!parsed) return false;
  const windowStart = startOfDay(today);
  windowStart.setDate(windowStart.getDate() - 7);
  const activityDay = startOfDay(parsed);
  return activityDay >= windowStart && activityDay <= startOfDay(today);
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
    .filter((item) => isWithinLastWeek(item.date, today))
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

function toneBadgeClass(tone: DeadlineItem["tone"]) {
  if (tone === "danger") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (tone === "warning") {
    return "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }
  return "border-primary/20 bg-primary/10 text-primary";
}

function activityToneStyles(tone: ActivityItem["tone"]) {
  if (tone === "success") {
    return {
      icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
      ring: "ring-emerald-500/20",
    };
  }
  if (tone === "warning") {
    return {
      icon: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
      ring: "ring-amber-500/20",
    };
  }
  return {
    icon: "bg-primary/12 text-primary",
    ring: "ring-primary/20",
  };
}

function deadlineDateParts(value: string) {
  const parsed = parseLocalDate(value);
  if (!parsed) return { month: "--", day: "--" };
  return {
    month: parsed.toLocaleDateString(undefined, { month: "short" }),
    day: String(parsed.getDate()),
  };
}

function deadlineRelativeLabel(lastDate: string, today: Date) {
  const parsed = parseLocalDate(lastDate);
  if (!parsed) return null;
  const delta = Math.round(
    (parsed.getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta < 0) {
    const days = Math.abs(delta);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  return `${delta} days left`;
}

function deadlineAccentClass(tone: DeadlineItem["tone"]) {
  if (tone === "danger") return "bg-gradient-to-b from-rose-500 to-rose-600";
  if (tone === "warning") return "bg-gradient-to-b from-amber-400 to-amber-500";
  return "bg-gradient-to-b from-indigo-400 to-indigo-500";
}

function buildSummaryCards(args: {
  scope: DashboardScope;
  projects: Project[];
  employees: Employee[];
  deadlinesThisWeek: number;
  today: Date;
}) {
  const activeProjects = args.projects.filter((project) => project.status !== "Completed").length;
  const completedProjects = args.projects.filter((project) => project.status === "Completed").length;
  const yetToStartProjects = args.projects.filter(
    (project) =>
      project.status === "Yet To Start" && !isProjectDelayed(project, args.today),
  ).length;
  const activeTeams = new Set(args.employees.map((employee) => employee.team)).size;
  const pendingTasks = args.scope === "personal" ? activeProjects : yetToStartProjects;

  const cards: SummaryCardData[] = [
    {
      title: args.scope === "personal" ? "Assigned Projects" : "Active Projects",
      value: String(activeProjects),
      icon: BriefcaseBusiness,
      toneClass:
        "from-indigo-500/12 via-indigo-500/6 to-transparent text-indigo-600 dark:text-indigo-300",
    },
    {
      title: "Completed Projects",
      value: String(completedProjects),
      icon: CheckCircle2,
      toneClass:
        "from-emerald-500/12 via-emerald-500/6 to-transparent text-emerald-600 dark:text-emerald-300",
    },
    {
      title: args.scope === "personal" ? "Open Projects" : "Yet To Start",
      value: String(pendingTasks),
      icon: ListTodo,
      toneClass:
        "from-cyan-500/12 via-cyan-500/6 to-transparent text-cyan-600 dark:text-cyan-300",
    },
    {
      title: "Deadlines This Week",
      value: String(args.deadlinesThisWeek),
      icon: CalendarClock,
      toneClass:
        "from-amber-500/12 via-amber-500/6 to-transparent text-amber-700 dark:text-amber-300",
    },
  ];

  if (args.scope !== "personal") {
    cards.splice(2, 0, {
      title: "Active Teams",
      value: String(activeTeams),
      icon: Workflow,
      toneClass:
        "from-violet-500/12 via-violet-500/6 to-transparent text-violet-600 dark:text-violet-300",
    });

    cards.push({
      title: "Total Employees",
      value: String(args.employees.length),
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
        today,
      }),
    [dashboardScope, deadlinesThisWeek.length, scopedEmployees, scopedProjects, today],
  );

  const teamDistribution = React.useMemo<TeamDistributionDatum[]>(() => {
    if (dashboardScope === "personal") return [];
    const baseEmployees = dashboardScope === "company" ? employees : scopedEmployees;
    const total = baseEmployees.length;
    if (total === 0) return [];

    const teamCounts = new Map<TeamName, number>();
    for (const employee of baseEmployees) {
      teamCounts.set(employee.team, (teamCounts.get(employee.team) ?? 0) + 1);
    }

    const orderedTeams = [
      ...teamNames.filter((team) => teamCounts.has(team)),
      ...Array.from(teamCounts.keys()).filter((team) => !teamNames.includes(team)),
    ];

    return orderedTeams.map((team, index) => {
      const count = teamCounts.get(team) ?? 0;
      return {
        name: team,
        value: count,
        percentage: Math.round((count / total) * 100),
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
  }, [dashboardScope, employees, scopedEmployees, teamNames]);

  const activityItems = React.useMemo(
    () => buildActivityFeed(scopedProjects, dashboardScope === "company" ? employees : scopedEmployees, today),
    [dashboardScope, employees, scopedEmployees, scopedProjects, today],
  );

  const deadlineItems = React.useMemo(
    () => buildDeadlines(scopedProjects, today),
    [scopedProjects, today],
  );

  const showDistributionChart =
    dashboardScope !== "personal" && teamDistribution.length > 0;
  const isInitialLoading =
    dataLoading && scopedProjects.length === 0 && employees.length === 0 && teamNames.length === 0;

  return (
    <div className="space-y-6">
      {dataSummary?.backend === "memory" && (
        <DashboardReveal variant="in">
          <AlertStrip
            tone="warning"
            title="In-memory data"
            description={`${dataSummary.reason} Lists reset when the server restarts.`}
          />
        </DashboardReveal>
      )}
      {dataSummary?.backend === "error" && (
        <DashboardReveal variant="in" delayMs={60}>
          <AlertStrip
            tone="danger"
            title="MongoDB connection failed."
            description={dataSummary.message}
          />
        </DashboardReveal>
      )}
      {dataError && (
        <DashboardReveal variant="in" delayMs={120}>
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
        </DashboardReveal>
      )}

      {isInitialLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-6">
            {summaryCards.map((card, index) => (
              <DashboardReveal key={card.title} delayMs={index * 65} variant="scale">
                <SummaryCard {...card} />
              </DashboardReveal>
            ))}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <DashboardReveal delayMs={150} variant="up" className="h-full">
              <Card className="flex h-full flex-col overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/50 pb-4">
                <div className="space-y-1">
                  <CardTitle className={sectionTitleClassName}>
                    Project analytics
                  </CardTitle>
                  <p className={sectionDescriptionClassName}>
                    Status breakdown across your scoped portfolio
                  </p>
                </div>
                <Badge variant="outline" className="rounded-md border-border/60 bg-background/80 px-2.5 py-0.5 text-[11px] font-medium">
                  {dashboardScope === "company"
                    ? "Company-wide"
                    : dashboardScope === "team"
                      ? "Assigned team"
                      : "Personal"}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col p-0">
                {scopedProjects.length === 0 ? (
                  <div className="p-6">
                    <EmptySectionState
                      icon={FolderKanban}
                      title="No project analytics yet"
                      description="Projects assigned to this dashboard scope will appear here automatically."
                    />
                  </div>
                ) : (
                  <ProjectAnalyticsPanel data={statusData} total={scopedProjects.length} />
                )}
              </CardContent>
            </Card>
            </DashboardReveal>

            <DashboardReveal delayMs={220} variant="up" className="h-full">
            {showDistributionChart ? (
              <Card className="flex h-full flex-col overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
                <CardHeader className="border-b border-border/50 pb-4">
                  <div className="space-y-1">
                    <CardTitle className={sectionTitleClassName}>
                      Employee Distribution
                    </CardTitle>
                    <p className={sectionDescriptionClassName}>
                      Headcount by team · {scopedEmployees.length} employees in this view
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <EmployeeDistributionPanel data={teamDistribution} />
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
            </DashboardReveal>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <DashboardReveal delayMs={280} variant="up" className="h-full">
              <ActivityFeedPanel items={activityItems} today={today} />
            </DashboardReveal>

            <DashboardReveal delayMs={350} variant="up" className="h-full">
              <DeadlinesPanel items={deadlineItems} today={today} />
            </DashboardReveal>
          </section>
        </>
      )}
    </div>
  );
}

function statusIcon(name: string) {
  if (name === "Completed") return CheckCircle2;
  if (name === "In Progress") return Workflow;
  if (name === "Delayed") return ShieldAlert;
  return CircleDashed;
}

function describeDonutSegment(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startPercent: number,
  endPercent: number,
) {
  const toRadians = (degrees: number) => ((degrees - 90) * Math.PI) / 180;
  const startAngle = toRadians((startPercent / 100) * 360);
  const endAngle = toRadians((endPercent / 100) * 360);
  const largeArc = endPercent - startPercent > 50 ? 1 : 0;

  const outerStartX = cx + outerRadius * Math.cos(startAngle);
  const outerStartY = cy + outerRadius * Math.sin(startAngle);
  const outerEndX = cx + outerRadius * Math.cos(endAngle);
  const outerEndY = cy + outerRadius * Math.sin(endAngle);
  const innerEndX = cx + innerRadius * Math.cos(endAngle);
  const innerEndY = cy + innerRadius * Math.sin(endAngle);
  const innerStartX = cx + innerRadius * Math.cos(startAngle);
  const innerStartY = cy + innerRadius * Math.sin(startAngle);

  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}`,
    "Z",
  ].join(" ");
}

function donutSegmentTooltipPosition(
  startPercent: number,
  endPercent: number,
  innerRadius: number,
  outerRadius: number,
) {
  const midAngle = toRadians(((startPercent + endPercent) / 200) * 360);
  const midRadius = (innerRadius + outerRadius) / 2;
  return {
    x: 50 + midRadius * Math.cos(midAngle),
    y: 50 + midRadius * Math.sin(midAngle),
  };
}

function toRadians(degrees: number) {
  return ((degrees - 90) * Math.PI) / 180;
}

function ChartLinePatternBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.22] dark:opacity-[0.16]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-42deg, transparent, transparent 10px, hsl(var(--border) / 0.55) 10px, hsl(var(--border) / 0.55) 11px)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-1 py-2">
        {[0, 1, 2, 3, 4].map((line) => (
          <div key={line} className="border-t border-border/30" />
        ))}
      </div>
    </>
  );
}

function ProjectAnalyticsPanel({ data, total }: { data: StatusDatum[]; total: number }) {
  const activeTotal = data.reduce((sum, entry) => sum + entry.value, 0) || total;
  const maxValue = Math.max(...data.map((entry) => entry.value), 1);
  const delayedCount = data.find((entry) => entry.name === "Delayed")?.value ?? 0;
  const inProgressCount = data.find((entry) => entry.name === "In Progress")?.value ?? 0;
  const yTicks = Array.from({ length: 5 }, (_, index) =>
    Math.round(maxValue - (index * maxValue) / 4),
  );
  const plotHeight = 168;

  return (
    <div className="space-y-5 p-6">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{total}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-primary">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/15 px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delayed</p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
            {delayedCount}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/50 bg-background/80">
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <p className="text-xs font-medium text-muted-foreground">Project status breakdown</p>
          <p className="text-[11px] text-muted-foreground">{activeTotal} projects tracked</p>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="flex gap-3">
            <div
              className="flex w-6 shrink-0 flex-col justify-between text-[10px] tabular-nums text-muted-foreground"
              style={{ height: plotHeight }}
            >
              {yTicks.map((tick, index) => (
                <span key={`${tick}-${index}`} className="leading-none">
                  {tick}
                </span>
              ))}
            </div>

            <div className="min-w-0 flex-1">
              <div
                className="relative overflow-hidden border border-border/40 bg-background/60"
                style={{ height: plotHeight }}
              >
                <ChartLinePatternBackground />

                <div className="relative z-10 flex h-full items-end justify-between gap-1.5 px-1 sm:gap-3">
                  {data.map((entry) => {
                    const heightPercent = maxValue === 0 ? 0 : (entry.value / maxValue) * 100;
                    const barHeightPx = Math.max(
                      entry.value > 0 ? Math.round((heightPercent / 100) * plotHeight) : 0,
                      entry.value > 0 ? 6 : 0,
                    );
                    const valueLabelBottom =
                      barHeightPx > 28 ? barHeightPx - 22 : barHeightPx + 6;

                    return (
                      <div key={entry.name} className="relative flex h-full flex-1 items-end justify-center">
                        <span
                          className={`absolute left-1/2 z-20 -translate-x-1/2 text-xs font-semibold tabular-nums ${
                            barHeightPx > 28 ? "text-white" : "text-foreground"
                          }`}
                          style={{ bottom: valueLabelBottom }}
                        >
                          {entry.value}
                        </span>
                        <div
                          className="w-[72%] min-w-[1.75rem] max-w-[3.25rem] border border-black/10 transition-all duration-700 ease-out dark:border-white/10 sm:w-[68%]"
                          style={{
                            height: barHeightPx,
                            backgroundColor: entry.color,
                            opacity: entry.value > 0 ? 0.92 : 0,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1 sm:gap-2">
                {data.map((entry) => {
                  const Icon = statusIcon(entry.name);
                  const share = activeTotal === 0 ? 0 : Math.round((entry.value / activeTotal) * 100);

                  return (
                    <div key={entry.name} className="flex min-w-0 flex-col items-center gap-1 text-center">
                      <div
                        className="flex h-6 w-6 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${entry.color}18`, color: entry.color }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <p className="line-clamp-2 text-[10px] font-medium leading-tight text-foreground sm:text-[11px]">
                        {entry.name}
                      </p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">{share}%</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmployeeDistributionPanel({ data }: { data: TeamDistributionDatum[] }) {
  const totalEmployees = data.reduce((sum, entry) => sum + entry.value, 0);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const innerRadius = 27;
  const outerRadius = 48;

  let cumulative = 0;
  const segments = data.map((entry) => {
    const startPercent = cumulative;
    const slicePercent =
      totalEmployees === 0 ? 0 : (entry.value / totalEmployees) * 100;
    cumulative += slicePercent;
    return {
      ...entry,
      startPercent,
      endPercent: cumulative,
      displayPercentage: Math.round(slicePercent),
    };
  });

  const hoveredSegment = hoveredIndex === null ? null : segments[hoveredIndex] ?? null;
  const tooltipPos = hoveredSegment
    ? donutSegmentTooltipPosition(
        hoveredSegment.startPercent,
        hoveredSegment.endPercent,
        innerRadius,
        outerRadius,
      )
    : null;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
      <div className="flex shrink-0 flex-col items-center">
        <div className="relative h-44 w-44 sm:h-48 sm:w-48 lg:h-[13.25rem] lg:w-[13.25rem]">
          <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Employee distribution by team">
            {segments.map((entry, index) => (
              <path
                key={entry.name}
                d={describeDonutSegment(
                  50,
                  50,
                  innerRadius,
                  outerRadius,
                  entry.startPercent,
                  entry.endPercent,
                )}
                fill={entry.color}
                className="cursor-pointer transition-opacity duration-200"
                style={{ opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.45 }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            ))}
          </svg>
          {hoveredSegment && tooltipPos ? (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-center shadow-md"
              style={{ left: `${tooltipPos.x}%`, top: `${tooltipPos.y}%` }}
            >
              <p className="whitespace-nowrap text-xs font-medium text-foreground">
                {teamTabLabel(hoveredSegment.name)}
              </p>
              <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                {hoveredSegment.displayPercentage}% · {hoveredSegment.value} members
              </p>
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
              {totalEmployees}
            </span>
            <span className="mt-1 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Employees
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {data.map((entry) => {
          const share =
            totalEmployees === 0 ? 0 : Math.round((entry.value / totalEmployees) * 100);
          return (
          <div
            key={entry.name}
            className="rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 transition-colors duration-300 hover:border-border/80"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: entry.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{teamTabLabel(entry.name)}</p>
                  <p className="text-[11px] text-muted-foreground">{share}% share</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">{entry.value}</p>
                <p className="text-[10px] text-muted-foreground">members</p>
              </div>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(share, share > 0 ? 4 : 0)}%`,
                  background: `linear-gradient(90deg, ${entry.color}, ${entry.color}aa)`,
                }}
              />
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function ActivityFeedPanel({ items, today }: { items: ActivityItem[]; today: Date }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/60 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-muted/10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            title="Recent activity"
            description="Updates from the last 7 days"
          />
          {items.length > 0 ? (
            <span className="shrink-0 rounded-full border border-border/60 bg-background/80 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {items.length}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptySectionState
              icon={Sparkles}
              title="No recent activity yet"
              description="Activity snapshots will appear as project timelines and employee updates are available."
            />
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            <div className="px-4 py-5 sm:px-5">
              <div className="divide-y divide-border/40">
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const tone = activityToneStyles(item.tone);
                  const isLast = index === items.length - 1;
                  return (
                    <DashboardReveal
                      key={item.id}
                      variant="in"
                      delayMs={320 + Math.min(index, 6) * 45}
                    >
                      <div className="group relative flex gap-3.5 rounded-xl px-1 py-3 transition-colors duration-200 hover:bg-muted/25 sm:gap-4">
                        <div className="relative flex w-10 shrink-0 flex-col items-center self-stretch">
                          <div
                            className={cn(
                              "relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-background shadow-sm transition-transform duration-200 group-hover:scale-105",
                              tone.ring,
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-full",
                                tone.icon,
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          {!isLast ? (
                            <span
                              className="pointer-events-none absolute left-1/2 top-10 w-px -translate-x-1/2 bg-gradient-to-b from-border/70 via-border/50 to-border/40"
                              style={{ bottom: "calc(-0.75rem - 1px)" }}
                              aria-hidden
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold leading-snug text-foreground">
                              {item.title}
                            </p>
                            <span className="shrink-0 rounded-md bg-muted/50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                              {relativeDateLabel(item.date, today)}
                            </span>
                          </div>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </DashboardReveal>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function DeadlinesPanel({ items, today }: { items: DeadlineItem[]; today: Date }) {
  return (
    <Card className="gallery-glass-panel relative flex h-full flex-col overflow-hidden rounded-2xl border-0 bg-transparent shadow-none hover:shadow-none">
      <div className="pointer-events-none absolute -right-16 top-8 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/10" aria-hidden />
      <div className="pointer-events-none absolute -left-12 bottom-6 h-36 w-36 rounded-full bg-rose-400/15 blur-3xl dark:bg-rose-500/10" aria-hidden />

      <CardHeader className="relative border-b border-white/25 bg-white/15 pb-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start justify-between gap-3">
          <SectionHeader
            title="Upcoming deadlines"
            description="Sorted by nearest due date"
          />
          {items.length > 0 ? (
            <span className="gallery-glass-caption shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
              {items.length}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="relative flex-1 p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptySectionState
              icon={CalendarClock}
              title="No upcoming deadlines"
              description="Open project deadlines will appear here automatically."
            />
          </div>
        ) : (
          <ScrollArea className="h-[360px]">
            <div className="space-y-3 p-4 sm:p-5">
              {items.map((item, index) => {
                const dateParts = deadlineDateParts(item.project.lastDate);
                const relativeLabel = deadlineRelativeLabel(item.project.lastDate, today);
                const statusBadge = projectStatusBadge(item.project, today);
                const showStatusBadge = statusBadge.label !== item.label;

                return (
                  <DashboardReveal
                    key={item.project.id}
                    variant="in"
                    delayMs={380 + Math.min(index, 6) * 45}
                  >
                    <article className="group">
                      <div className="gallery-glass-panel relative overflow-hidden rounded-2xl transition-all duration-500 ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_20px_50px_-16px_rgba(15,23,42,0.28)] dark:group-hover:shadow-[0_20px_50px_-16px_rgba(0,0,0,0.5)]">
                        <div
                          className="gallery-glass-shine pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/45 via-white/10 to-transparent dark:from-white/12"
                          aria-hidden
                        />
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full opacity-90",
                            deadlineAccentClass(item.tone),
                          )}
                        />

                        <div className="relative flex items-center gap-3.5 p-3.5 pl-4 sm:gap-4 sm:p-4 sm:pl-5">
                          <div className="gallery-glass-caption flex h-[3.25rem] w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-xl shadow-sm">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {dateParts.month}
                            </span>
                            <span className="text-xl font-bold tabular-nums leading-none tracking-tight text-foreground">
                              {dateParts.day}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {item.project.name}
                              </p>
                              <span
                                className={cn(
                                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm",
                                  toneBadgeClass(item.tone),
                                )}
                              >
                                {item.label}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              {item.project.teams.map((team) => (
                                <span
                                  key={team}
                                  className="rounded-md border border-white/30 bg-white/25 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm dark:border-white/10 dark:bg-white/10"
                                >
                                  {teamTabLabel(team)}
                                </span>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">
                                {relativeLabel ?? `Due ${formatShortDate(item.project.lastDate)}`}
                              </span>
                              {showStatusBadge ? (
                                <Badge variant={statusBadge.variant} className="text-[10px]">
                                  {statusBadge.label}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  </DashboardReveal>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardReveal({
  children,
  className,
  delayMs = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  variant?: "up" | "in" | "scale";
}) {
  return (
    <div
      className={cn(
        variant === "up" && "dashboard-reveal-up",
        variant === "in" && "dashboard-reveal-in",
        variant === "scale" && "dashboard-reveal-scale",
        className,
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
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

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1">
      <SectionTitle>{title}</SectionTitle>
      {description ? (
        <p className={sectionDescriptionClassName}>{description}</p>
      ) : null}
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, toneClass }: SummaryCardData) {
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
    <Card className="flex h-full flex-col overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className={sectionTitleClassName}>
          {scope === "personal" ? "Personal focus" : team ? `${teamTabLabel(team)} spotlight` : "Workspace spotlight"}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        <ScrollArea className="h-[360px]">
          <div className="space-y-6 p-6">
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
                        <AvatarFallback>{profileInitials(employee.name)}</AvatarFallback>
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
          </div>
        </ScrollArea>
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
        <div className="h-[430px] rounded-[24px] border border-border/60 bg-muted/30" />
      </div>
    </div>
  );
}

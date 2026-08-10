"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  RefreshCw,
  ShieldAlert,
  Users2,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatRelativeCalendarDate,
  formatShortDate,
  type DashboardActivityItem,
  type DashboardDeadlineItem,
  type DashboardKpi,
  type DashboardOverview,
  type EmployeeDistributionStat,
  type ProjectStatusStat,
} from "@/lib/dashboard-overview";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";

function kpiIcon(id: DashboardKpi["id"]) {
  if (id === "totalProjects") return FolderKanban;
  if (id === "activeProjects") return BriefcaseBusiness;
  if (id === "totalEmployees") return Users2;
  return AlertTriangle;
}

function kpiTone(id: DashboardKpi["id"]) {
  if (id === "totalProjects") {
    return "from-slate-500/10 via-slate-500/5 to-transparent text-slate-600 dark:text-slate-300";
  }
  if (id === "activeProjects") {
    return "from-indigo-500/12 via-indigo-500/6 to-transparent text-indigo-600 dark:text-indigo-300";
  }
  if (id === "totalEmployees") {
    return "from-cyan-500/12 via-cyan-500/6 to-transparent text-cyan-700 dark:text-cyan-300";
  }
  return "from-amber-500/12 via-amber-500/6 to-transparent text-amber-700 dark:text-amber-300";
}

function greetingPrefix(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardWelcomeHeader({
  name,
  scopeLabel,
  onRefresh,
  refreshing,
}: {
  name: string;
  scopeLabel: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const first = name.trim().split(/\s+/)[0] || "there";
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
            {greetingPrefix()}, {first}
          </h1>
          <Badge
            variant="outline"
            className="rounded-lg border-border/70 bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium"
          >
            {scopeLabel}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening across your workspace today.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRefresh ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        ) : null}
        <Button asChild size="sm" className="h-9 gap-1.5 rounded-xl">
          <Link href="/projects">
            View projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function DashboardKpiGrid({ kpis }: { kpis: DashboardKpi[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = kpiIcon(kpi.id);
        return (
          <Card
            key={kpi.id}
            className="relative overflow-hidden border-border/70 bg-background/80 shadow-sm"
          >
            <div className={cn("absolute inset-0 bg-gradient-to-br", kpiTone(kpi.id))} />
            <CardContent className="relative flex items-start justify-between gap-3 p-5">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                  {kpi.value}
                </p>
                <p className="text-xs text-muted-foreground">{kpi.description}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5 shadow-sm">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function statusIcon(name: ProjectStatusStat["name"]) {
  if (name === "Completed") return CheckCircle2;
  if (name === "In Progress") return Workflow;
  if (name === "Delayed") return ShieldAlert;
  return CircleDashed;
}

function statusBarFillClass(name: ProjectStatusStat["name"]) {
  if (name === "Completed") return "bg-emerald-500";
  if (name === "In Progress") return "bg-indigo-500";
  if (name === "Delayed") return "bg-amber-500";
  return "bg-slate-400 dark:bg-slate-500";
}

function statusIconToneClass(name: ProjectStatusStat["name"]) {
  if (name === "Completed") return "text-emerald-600 dark:text-emerald-400";
  if (name === "In Progress") return "text-indigo-600 dark:text-indigo-400";
  if (name === "Delayed") return "text-amber-700 dark:text-amber-400";
  return "text-slate-500 dark:text-slate-400";
}

function projectStatusPercentage(count: number, total: number) {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
}

function projectOverviewInsight(stats: ProjectStatusStat[], total: number) {
  if (total <= 0) return null;
  const delayed = stats.find((entry) => entry.name === "Delayed")?.value ?? 0;
  const completed = stats.find((entry) => entry.name === "Completed")?.value ?? 0;
  if (delayed > 0) {
    return `${delayed} of ${total} project${total === 1 ? "" : "s"} ${
      delayed === 1 ? "is" : "are"
    } currently delayed and may require attention.`;
  }
  if (completed === total) {
    return "All projects have been completed.";
  }
  return "All projects are currently on schedule.";
}

export function DashboardProjectOverview({
  stats,
  total,
}: {
  stats: ProjectStatusStat[];
  total: number;
}) {
  const totalProjects = Math.max(
    0,
    stats.reduce((sum, entry) => sum + entry.value, 0) || total,
  );
  const insight = projectOverviewInsight(stats, totalProjects);

  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Project overview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Status breakdown for your current scope
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
          <Link href="/projects">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        {totalProjects === 0 ? (
          <EmptyBlock
            icon={FolderKanban}
            title="No projects yet"
            description="Projects will appear here once they are created."
            action={
              <Button asChild size="sm" className="mt-4 h-8 rounded-lg text-xs">
                <Link href="/projects/new">Create project</Link>
              </Button>
            }
          />
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {totalProjects}
              </span>{" "}
              <span className="text-muted-foreground">Total Projects</span>
            </p>

            <ul className="space-y-3.5" aria-label="Project status distribution">
              {stats.map((entry) => {
                const Icon = statusIcon(entry.name);
                const percentage = projectStatusPercentage(entry.value, totalProjects);
                const widthPercent = Math.min(100, Math.max(0, percentage));
                return (
                  <li key={entry.name} className="group relative">
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          statusIconToneClass(entry.name),
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                        {entry.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                        {entry.value}
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                        {percentage}%
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted/70"
                      title={`${entry.name}: ${entry.value} projects (${percentage}% of total)`}
                    >
                      <div
                        className={cn(
                          "h-full rounded-full transition-[width] duration-300 ease-out",
                          statusBarFillClass(entry.name),
                        )}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>

                    <div
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 w-max -translate-x-1/2 rounded-lg border border-border/70 bg-popover px-3 py-2 text-left text-xs text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <p className="font-semibold text-foreground">{entry.name}</p>
                      <p className="mt-0.5 text-muted-foreground">
                        {entry.value} project{entry.value === 1 ? "" : "s"}
                      </p>
                      <p className="text-muted-foreground">{percentage}% of total</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {insight ? (
              <p className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                {insight}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
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

export function DashboardEmployeeDistribution({
  data,
  total,
}: {
  data: EmployeeDistributionStat[];
  total: number;
}) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const innerRadius = 27;
  const outerRadius = 48;
  const segments = data.reduce<
    Array<EmployeeDistributionStat & { startPercent: number; endPercent: number }>
  >((acc, entry) => {
    const startPercent = acc.length === 0 ? 0 : acc[acc.length - 1]!.endPercent;
    const slicePercent = total === 0 ? 0 : (entry.value / total) * 100;
    acc.push({ ...entry, startPercent, endPercent: startPercent + slicePercent });
    return acc;
  }, []);
  const hovered = hoveredIndex === null ? null : segments[hoveredIndex] ?? null;

  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Employee distribution
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Headcount by team · {total} employees
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
          <Link href="/team-members">Directory</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-5">
        {data.length === 0 ? (
          <EmptyBlock
            icon={Users2}
            title="No distribution to show"
            description="Team headcount appears here for company and team scopes."
          />
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="relative mx-auto h-44 w-44 shrink-0 sm:h-48 sm:w-48">
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full"
                aria-label="Employee distribution by team"
              >
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
                    className="cursor-pointer transition-opacity duration-150"
                    style={{
                      opacity:
                        hoveredIndex === null || hoveredIndex === index ? 1 : 0.4,
                    }}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {hovered?.value ?? total}
                </span>
                <span className="mt-1 max-w-[6.5rem] truncate text-[11px] text-muted-foreground">
                  {hovered ? hovered.label : "Employees"}
                </span>
              </div>
            </div>

            <ul className="min-w-0 flex-1 space-y-2">
              {data.map((entry, index) => (
                <li
                  key={entry.name}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border border-transparent px-2 py-1.5 transition-colors",
                    hoveredIndex === index && "border-border/60 bg-muted/30",
                  )}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {entry.value} · {entry.percentage}%
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function activityIcon(item: DashboardActivityItem) {
  if (item.tone === "success") return CheckCircle2;
  if (item.tone === "warning") return ShieldAlert;
  if (item.kind === "employee") return Users2;
  return BriefcaseBusiness;
}

function activityToneClass(tone: DashboardActivityItem["tone"]) {
  if (tone === "success") return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400";
  if (tone === "warning") return "bg-amber-500/12 text-amber-700 dark:text-amber-400";
  return "bg-primary/10 text-primary";
}

export function DashboardRecentActivity({
  items,
  today,
}: {
  items: DashboardActivityItem[];
  today: Date;
}) {
  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/80 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base font-semibold tracking-tight">
          Recent activity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Project and directory changes from the last week
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyBlock
              icon={CalendarClock}
              title="No recent activity"
              description="Completions, delays, and new joiners from the past week show up here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => {
              const Icon = activityIcon(item);
              return (
                <li key={item.id} className="flex gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                      activityToneClass(item.tone),
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatRelativeCalendarDate(item.date, today)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function deadlineToneClass(tone: DashboardDeadlineItem["tone"]) {
  if (tone === "danger") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  }
  if (tone === "warning") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  }
  return "border-border/70 bg-muted/30 text-muted-foreground";
}

export function DashboardUpcomingDeadlines({
  items,
}: {
  items: DashboardDeadlineItem[];
}) {
  return (
    <Card className="flex h-full flex-col border-border/70 bg-background/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight">
            Upcoming deadlines
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Nearest due dates across open projects
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
          <Link href="/projects">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        {items.length === 0 ? (
          <div className="p-5">
            <EmptyBlock
              icon={CalendarClock}
              title="No open deadlines"
              description="Active projects with due dates will appear here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((item) => (
              <li key={item.projectId}>
                <Link
                  href={`/projects/${encodeURIComponent(item.slug)}`}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <div className="w-12 shrink-0 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatShortDate(item.lastDate).split(" ")[0]}
                    </p>
                    <p className="text-lg font-semibold tabular-nums leading-none text-foreground">
                      {formatShortDate(item.lastDate).split(" ")[1]?.replace(",", "") ??
                        "--"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.projectName}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          deadlineToneClass(item.tone),
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.relativeLabel}
                      {item.teams.length > 0
                        ? ` · ${item.teams.map(teamTabLabel).join(", ")}`
                        : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyBlock({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
        <div className="h-80 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
        <div className="h-72 animate-pulse rounded-2xl border border-border/60 bg-muted/40" />
      </div>
    </div>
  );
}

export function DashboardAlert({
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
        "rounded-2xl border px-4 py-3 text-sm",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-rose-500/30 bg-rose-500/10 text-rose-950 dark:text-rose-100",
      )}
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sm opacity-90">{description}</div>
    </div>
  );
}

export type { DashboardOverview };

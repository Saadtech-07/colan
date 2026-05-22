"use client";

import * as React from "react";
import {
  Briefcase,
  CheckCircle2,
  Users,
  UsersRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/providers/app-state";
import { projectStats } from "@/lib/mock-data";
import { TEAMS } from "@/lib/constants";
import type { Project, TeamName } from "@/types";
import { AddProjectDialog } from "@/components/features/add-project-dialog";
import { ProjectAnalyticsChart } from "@/components/features/project-analytics-chart";
import { RoleAccessPanel } from "@/components/features/role-access-panel";
import { cn } from "@/lib/utils";

function statusBadge(status: Project["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "In Progress") return "default" as const;
  return "warning" as const;
}

export default function DashboardPage() {
  const {
    projects,
    addProject,
    access,
    user,
    employees,
    dataError,
    dataSummary,
  } = useAppState();
  const visibleProjects = projects;
  const stats = projectStats(visibleProjects);
  const teamCount = new Set(visibleProjects.map((p) => p.team)).size;
  const teamsToShow =
    access?.seesAllTeams || !user?.team ? TEAMS : [user.team];

  const byTeam = teamsToShow.reduce(
    (acc, team) => {
      acc[team] = visibleProjects.filter((p) => p.team === team);
      return acc;
    },
    {} as Record<TeamName, Project[]>,
  );

  return (
    <div className="space-y-8">
      {dataSummary?.backend === "mongodb" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100">
            <span className="font-medium">MongoDB Atlas</span> — database{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {dataSummary.database}
            </code>
            . Core counts: employees {dataSummary.counts.employees}, projects{" "}
            {dataSummary.counts.projects}, gallery {dataSummary.counts.gallery}, app users{" "}
            {dataSummary.counts.appUsers}. CRUD in this app writes to the collections below
            (empty collections still appear after indexes are created).
          </div>
          <div className="rounded-lg border border-border/80 bg-card px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold tracking-tight">
              Collections in this cluster database
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Names match Atlas; counts refresh when you load the dashboard.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {dataSummary.allCollections.map((c) => (
                <li
                  key={c.name}
                  className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5"
                >
                  <p className="text-xs font-medium leading-snug">{c.label}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{c.name}</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">{c.count}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {dataSummary?.backend === "memory" && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          <span className="font-medium">In-memory data</span> — {dataSummary.reason} Lists reset
          when the server restarts.
        </div>
      )}
      {dataSummary?.backend === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="font-medium">MongoDB connection failed.</span> {dataSummary.message}
        </div>
      )}
      {dataError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dataError}{" "}
          <span className="text-muted-foreground">
            Check API routes and optional <code className="text-xs">MONGODB_URI</code>.
          </span>
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard :)
          </h1>
          <p className="mt-1 text-muted-foreground">
            {access?.seesAllTeams
              ? "Company-wide project pulse and team workload."
              : access?.canManageProjects
                ? `Manage delivery for ${user?.team ?? "your squad"}.`
                : `View projects for ${user?.team ?? "your team"}.`}
          </p>
        </div>
        {access?.canManageProjects && (
          <AddProjectDialog
            onCreate={addProject}
            lockedTeam={access.role === "lead" ? user?.team : undefined}
          />
        )}
      </div>

      {access && <RoleAccessPanel access={access} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total employees"
          value={String(employees.length)}
          hint="Directory size (this session)"
          icon={Users}
          className="from-slate-50 to-white"
        />
        <StatCard
          title="Projects in progress"
          value={String(stats.inProgress)}
          hint="Across visible teams"
          icon={Briefcase}
          className="from-blue-50/80 to-white"
        />
        <StatCard
          title="Completed projects"
          value={String(stats.completed)}
          hint="Lifetime in this session"
          icon={CheckCircle2}
          className="from-emerald-50/80 to-white"
        />
        <StatCard
          title="Active teams"
          value={String(teamCount || TEAMS.length)}
          hint="With at least one visible project"
          icon={UsersRound}
          className="from-violet-50/80 to-white"
        />
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Project analytics</CardTitle>
            <p className="text-sm text-muted-foreground">
              Starts vs completions (sample trend data)
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectAnalyticsChart />
        </CardContent>
      </Card>

      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Team-based projects
          </h2>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {teamsToShow.map((team) => (
            <Card
              key={team}
              className="overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardHeader className="border-b bg-muted/40 pb-3">
                <CardTitle className="text-base font-semibold">{team}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {byTeam[team].length} project
                  {byTeam[team].length === 1 ? "" : "s"}
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y">
                  {byTeam[team].length === 0 ? (
                    <li className="px-6 py-8 text-center text-sm text-muted-foreground">
                      No projects yet.
                    </li>
                  ) : (
                    byTeam[team].map((p) => (
                      <li
                        key={p.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 transition-colors hover:bg-muted/40"
                      >
                        <div>
                          <p className="font-medium leading-tight">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.assignedDate} → {p.lastDate}
                          </p>
                        </div>
                        <Badge variant={statusBadge(p.status)}>{p.status}</Badge>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border/60 bg-gradient-to-br shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

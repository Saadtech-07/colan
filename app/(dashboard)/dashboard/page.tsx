"use client";

import * as React from "react";
import {
  Briefcase,
  CheckCircle2,
  Users,
  UsersRound,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/providers/app-state";
import { projectStats } from "@/lib/mock-data";
import { TEAMS } from "@/lib/constants";
import type { Project, TeamName } from "@/types";
import { AddProjectDialog } from "@/components/features/add-project-dialog";
import { ProjectAnalyticsChart } from "@/components/features/project-analytics-chart";
import { cn } from "@/lib/utils";

function statusBadge(status: Project["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "In Progress") return "default" as const;
  return "warning" as const;
}

function statusProgress(status: Project["status"]) {
  if (status === "Completed") return 100;
  if (status === "In Progress") return 50;
  return 0;
}

function statusColor(status: Project["status"]) {
  if (status === "Completed") return "bg-emerald-500";
  if (status === "In Progress") return "bg-blue-500";
  return "bg-amber-500";
}

export default function DashboardPage() {
  const {
    projects,
    addProject,
    addNotification,
    isAdmin,
    user,
    employees,
    dataLoading,
    dataError,
  } = useAppState();
  const visibleProjects =
    isAdmin || !user?.team
      ? projects
      : projects.filter((p) => p.team === user.team);
  const stats = projectStats(visibleProjects);
  const teamCount = new Set(visibleProjects.map((p) => p.team)).size;

  const byTeam = TEAMS.reduce(
    (acc, team) => {
      acc[team] = visibleProjects.filter((p) => p.team === team);
      return acc;
    },
    {} as Record<TeamName, Project[]>,
  );

  const handleProjectCreate = async (project: Omit<Project, "id">) => {
    await addNotification({
      projectId: "temp-id",
      projectName: project.name,
      team: project.team,
      assignedDate: project.assignedDate,
      status: project.status,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-8">
      {dataError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dataError}{" "}
          <span className="text-muted-foreground">
            Check API routes and optional <code className="text-xs">MONGODB_URI</code>.
          </span>
        </div>
      )}
      {dataLoading && !dataError && (
        <p className="text-sm text-muted-foreground">Syncing workspace data…</p>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? "Company-wide project pulse and team workload."
              : `Projects for ${user?.team ?? "your team"}.`}
          </p>
        </div>
        {isAdmin && <AddProjectDialog onCreate={addProject} onNotificationTrigger={handleProjectCreate} />}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total projects"
          value={String(stats.total)}
          hint="Across visible teams"
          icon={Briefcase}
          className="from-slate-50 to-white"
        />
        <StatCard
          title="In progress"
          value={String(stats.inProgress)}
          hint="Currently active"
          icon={Briefcase}
          className="from-blue-50/80 to-white"
        />
        <StatCard
          title="Completed"
          value={String(stats.completed)}
          hint="Successfully delivered"
          icon={CheckCircle2}
          className="from-emerald-50/80 to-white"
        />
        <StatCard
          title="Pending"
          value={String(stats.yetToStart)}
          hint="Yet to start"
          icon={UsersRound}
          className="from-amber-50/80 to-white"
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
          {TEAMS.map((team) => (
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
                        className="flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-muted/40"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium leading-tight">{p.name}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{p.assignedDate} → {p.lastDate}</span>
                            </div>
                          </div>
                          <Badge variant={statusBadge(p.status)}>{p.status}</Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progress</span>
                            <span>{statusProgress(p.status)}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500 ease-out",
                                statusColor(p.status)
                              )}
                              style={{ width: `${statusProgress(p.status)}%` }}
                            />
                          </div>
                        </div>
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
        "relative overflow-hidden border-border/60 bg-linear-to-br shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
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

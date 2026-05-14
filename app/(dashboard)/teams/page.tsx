"use client";

import * as React from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/providers/app-state";
import { TEAMS } from "@/lib/constants";
import type { Project, TeamName } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

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

export default function TeamsPage() {
  const { projects, isAdmin, user } = useAppState();

  const visibleProjects =
    isAdmin || !user?.team
      ? projects
      : projects.filter((p) => p.team === user.team);

  const byTeam = TEAMS.reduce(
    (acc, team) => {
      acc[team] = visibleProjects.filter((p) => p.team === team);
      return acc;
    },
    {} as Record<TeamName, Project[]>,
  );

  const teamStats = TEAMS.reduce(
    (acc, team) => {
      const teamProjects = byTeam[team];
      acc[team] = {
        total: teamProjects.length,
        completed: teamProjects.filter((p) => p.status === "Completed").length,
        inProgress: teamProjects.filter((p) => p.status === "In Progress").length,
        yetToStart: teamProjects.filter((p) => p.status === "Yet To Start").length,
      };
      return acc;
    },
    {} as Record<TeamName, { total: number; completed: number; inProgress: number; yetToStart: number }>,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Team Projects
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isAdmin
              ? "Overview of all team projects and their status."
              : `Projects for ${user?.team ?? "your team"}.`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TEAMS.map((team) => {
          const stats = teamStats[team];
          const teamProjects = byTeam[team];
          const isUserTeam = user?.team === team;

          return (
            <Card
              key={team}
              className={cn(
                "overflow-hidden transition-all duration-200 hover:shadow-lg",
                isUserTeam && "ring-2 ring-primary/20"
              )}
            >
              <CardHeader className="border-b bg-muted/40 pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold">{team}</CardTitle>
                  {isUserTeam && (
                    <Badge variant="secondary" className="text-xs">
                      Your Team
                    </Badge>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5" />
                    <span>{stats.total} projects</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{stats.completed} completed</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span>{stats.inProgress} in progress</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                    <span>{stats.yetToStart} pending</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {teamProjects.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No projects assigned yet.
                    </p>
                  ) : (
                    teamProjects.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/50 p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm leading-tight">{p.name}</p>
                          <Badge variant={statusBadge(p.status)} className="text-xs">
                            {p.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{p.assignedDate} → {p.lastDate}</span>
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
                      </div>
                    ))
                  )}
                  {teamProjects.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      asChild
                    >
                      <Link href={`/dashboard?team=${encodeURIComponent(team)}`}>
                        View all {teamProjects.length} projects
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

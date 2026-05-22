"use client";

import * as React from "react";
import Link from "next/link";
import { Briefcase, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddProjectDialog } from "@/components/features/add-project-dialog";
import { AddTeamDialog } from "@/components/features/add-team-dialog";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { projectBelongsToTeam } from "@/lib/project-teams";
import { teamTabLabel } from "@/lib/team-utils";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import type { Project, ProjectStatus, TeamName } from "@/types";

const ALL_TAB = "All";

function statusVariant(status: ProjectStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "In Progress") return "default" as const;
  return "warning" as const;
}

export default function ProjectsPage() {
  const { projects, addProject, access, user, teamNames, isAdmin } = useAppState();
  const { withLoading } = useGlobalLoading();
  const [tab, setTab] = React.useState<string>(ALL_TAB);

  const teamsToShow: TeamName[] =
    access?.seesAllTeams || !user?.team ? teamNames : [user.team];

  const filtered =
    tab === ALL_TAB
      ? projects
      : projects.filter((p) => projectBelongsToTeam(p, tab as TeamName));

  const byTeam = teamsToShow.reduce(
    (acc, team) => {
      acc[team] = projects.filter((p) => projectBelongsToTeam(p, team));
      return acc;
    },
    {} as Record<TeamName, Project[]>,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Team-based projects
          </h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Browse delivery work by squad. Open a project to view details when you have
            edit access.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && <AddTeamDialog />}
          {access?.canManageProjects && (
            <AddProjectDialog
              teamOptions={teamNames}
              onCreate={async (input) => {
                await withLoading("project-create", LOADING_PRESETS.creatingProject, () =>
                  addProject(input),
                );
              }}
              lockedTeam={access.role === "lead" ? user?.team : undefined}
            />
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value={ALL_TAB}>All teams</TabsTrigger>
          {teamsToShow.map((t) => (
            <TabsTrigger key={t} value={t}>
              {teamTabLabel(t)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-6">
          {tab === ALL_TAB ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {teamsToShow.map((team) => (
                <Card key={team} className="border-border/70">
                  <CardHeader className="border-b bg-muted/30 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Briefcase className="h-4 w-4 text-primary" />
                      {team}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ProjectLinkList items={byTeam[team]} />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border/70">
              <CardContent className="p-0">
                <ProjectLinkList items={filtered} />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectLinkList({ items }: { items: Project[] }) {
  if (items.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-muted-foreground">
        No projects for this team yet.
      </p>
    );
  }
  return (
    <ul className="divide-y">
      {items.map((p) => {
        return (
          <li key={p.id}>
            <Link
              href={`/projects/${p.slug}`}
              className="block px-6 py-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-medium leading-tight">{p.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.teams.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] font-normal">
                        {teamTabLabel(t)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.assignedDate} → {p.lastDate}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-0.5">
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Code2,
  FolderKanban,
  Layers3,
  Palette,
  Server,
  Users2,
  Wrench,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddProjectDialog } from "@/components/features/add-project-dialog";
import { AddTeamDialog } from "@/components/features/add-team-dialog";
import { TeamActionsMenu } from "@/components/features/team-actions-menu";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import {
  formatProjectDate,
  projectPriority,
  projectProgressPercent,
  relativeProjectDeadline,
} from "@/lib/project-ui";
import {
  ALL_PROJECTS_SECTION,
  discoverTeamsFromProjects,
  projectBelongsToTeam,
  UNASSIGNED_PROJECTS_SECTION,
} from "@/lib/project-teams";
import { canViewAllWorkspaceProjects } from "@/lib/permissions";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import type { Project, ProjectStatus, TeamName } from "@/types";
import type { TeamDTO } from "@/models";
import { profileInitials } from "@/lib/profile-image";

const ALL_TAB = "All";

function renderTeamIcon(team: string | undefined | null, className?: string) {
  const normalized = (team ?? "").trim().toLowerCase();
  if (!normalized) {
    return <FolderKanban className={className} />;
  }
  if (normalized.includes("react") || normalized.includes("next")) {
    return <Code2 className={className} />;
  }
  if (
    normalized.includes("node") ||
    normalized.includes("java") ||
    normalized.includes("python")
  ) {
    return <Server className={className} />;
  }
  if (normalized.includes("ui") || normalized.includes("design")) {
    return <Palette className={className} />;
  }
  if (normalized.includes("devops")) return <Cloud className={className} />;
  if (normalized.includes("test")) return <Wrench className={className} />;
  return <Layers3 className={className} />;
}

function teamCompletionPercentage(projects: Project[]) {
  if (projects.length === 0) return 0;
  return Math.round(
    (projects.filter((project) => project.status === "Completed").length /
      projects.length) *
      100,
  );
}

export default function ProjectsPage() {
  const {
    projects,
    addProject,
    access,
    user,
    teamNames,
    workspaceTeams,
    isAdmin,
    employees,
    refreshData,
    dataLoading,
    dataSummary,
    updateWorkspaceTeam,
    deleteWorkspaceTeam,
  } = useAppState();
  const { withLoading } = useGlobalLoading();
  const [tab, setTab] = React.useState<string>(ALL_TAB);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [teamActionError, setTeamActionError] = React.useState<string | null>(null);
  const tabRailRef = React.useRef<HTMLDivElement>(null);
  const today = React.useMemo(() => new Date(), []);

  const isBroadViewer =
    access?.seesAllTeams ?? (access ? canViewAllWorkspaceProjects(access.role) : false);
  const isAssignedProjectsOnly = !isBroadViewer && !access?.canManageProjects;

  const currentEmployee = React.useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return (
      employees.find(
        (employee) =>
          employee.email?.toLowerCase() === email ||
          employee.directory?.workEmail?.toLowerCase() === email,
      ) ?? null
    );
  }, [employees, user?.email]);

  const scopedProjects = React.useMemo(() => {
    if (!isAssignedProjectsOnly) return projects;
    if (!currentEmployee) return [];
    return projects.filter((project) => project.memberIds.includes(currentEmployee.id));
  }, [currentEmployee, isAssignedProjectsOnly, projects]);

  const teamsToShow: TeamName[] = React.useMemo(() => {
    if (isBroadViewer) {
      return discoverTeamsFromProjects(teamNames, projects);
    }
    const names = user?.team ? [user.team] : [];
    return names.filter(
      (name): name is TeamName => typeof name === "string" && name.trim().length > 0,
    );
  }, [isBroadViewer, projects, teamNames, user?.team]);

  React.useEffect(() => {
    if (!isBroadViewer && user?.team && tab === ALL_TAB) {
      setTab(user.team);
    }
  }, [isBroadViewer, tab, user?.team]);

  React.useEffect(() => {
    if (dataLoading || projects.length > 0) return;
    const mongoCount =
      dataSummary?.backend === "mongodb" ? (dataSummary.counts?.projects ?? 0) : 0;
    if (mongoCount > 0) {
      void refreshData();
    }
  }, [dataLoading, dataSummary, projects.length, refreshData]);

  const filtered =
    tab === ALL_TAB
      ? scopedProjects
      : scopedProjects.filter((p) => projectBelongsToTeam(p, tab as TeamName));

  const activeTeamTab = !isBroadViewer && user?.team ? user.team : tab;

  const singleTeamTab = React.useMemo(() => {
    if (tab === ALL_TAB) return null;
    if (isBroadViewer) {
      const name = tab.trim();
      return name.length > 0 ? (name as TeamName) : null;
    }
    const squad = user?.team?.trim();
    return squad ? (squad as TeamName) : null;
  }, [isBroadViewer, tab, user?.team]);

  const updateProjectStatus = React.useCallback(
    async (project: Project, nextStatus: ProjectStatus) => {
      setStatusError(null);
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const message = await parseApiError(res);
        setStatusError(message);
        throw new Error(message);
      }
      await refreshData();
    },
    [refreshData],
  );

  const handleRenameTeam = React.useCallback(
    async (team: TeamDTO, nextName: string) => {
      setTeamActionError(null);
      const updated = await updateWorkspaceTeam(team.id, nextName);
      await refreshData();
      if (tab === team.name) {
        setTab(updated.name);
      }
    },
    [refreshData, tab, updateWorkspaceTeam],
  );

  const handleDeleteTeam = React.useCallback(
    async (team: TeamDTO) => {
      setTeamActionError(null);
      await deleteWorkspaceTeam(team.id);
      await refreshData();
      if (tab === team.name) {
        setTab(ALL_TAB);
      }
    },
    [deleteWorkspaceTeam, refreshData, tab],
  );

  return (
    <Tabs
      value={activeTeamTab}
      onValueChange={isBroadViewer ? setTab : () => undefined}
      className="space-y-6"
    >
      {(isAdmin || access?.canManageProjects) && (
        <div className="flex justify-end gap-2">
          {isAdmin && <AddTeamDialog />}
          {access?.canManageProjects && (
            <AddProjectDialog
              teamOptions={teamNames}
              onCreate={async (input) =>
                withLoading(
                  "project-create",
                  LOADING_PRESETS.creatingProject,
                  () => addProject(input),
                )
              }
              lockedTeam={access.role === "lead" ? user?.team : undefined}
            />
          )}
        </div>
      )}

      {isBroadViewer ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden h-10 w-10 shrink-0 rounded-2xl border-border/70 bg-background/80 shadow-sm sm:inline-flex"
            onClick={() => tabRailRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
            aria-label="Scroll team filters left"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div ref={tabRailRef} className="min-w-0 flex-1 overflow-x-auto scroll-smooth">
            <TabsList className="inline-flex h-11 min-w-max flex-nowrap items-center gap-1 rounded-2xl border border-border/70 bg-muted/40 p-1 shadow-sm">
              <TabsTrigger
                value={ALL_TAB}
                className="rounded-xl px-4 data-[state=active]:shadow-sm"
              >
                All teams
              </TabsTrigger>
              {teamsToShow.map((team) => (
                <TabsTrigger
                  key={team}
                  value={team}
                  className="rounded-xl px-4 data-[state=active]:shadow-sm"
                >
                  {teamTabLabel(team)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden h-10 w-10 shrink-0 rounded-2xl border-border/70 bg-background/80 shadow-sm sm:inline-flex"
            onClick={() => tabRailRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
            aria-label="Scroll team filters right"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {teamActionError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
          {teamActionError}
        </div>
      )}

      {statusError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
          {statusError}
        </div>
      )}

      <TabsContent value={activeTeamTab} className="mt-0">
        {isBroadViewer && tab === ALL_TAB ? (
          <TeamProjectSection
            team={ALL_PROJECTS_SECTION}
            teamRecord={null}
            items={scopedProjects}
            employees={employees}
            canEditStatus={!!access?.canManageProjects}
            canManageTeam={false}
            emptyMessage="No projects in your workspace yet. Add a project or check MongoDB connection in .env.local."
            onStatusChange={updateProjectStatus}
            onRenameTeam={handleRenameTeam}
            onDeleteTeam={handleDeleteTeam}
            onTeamActionError={setTeamActionError}
            today={today}
          />
        ) : singleTeamTab ? (
          <TeamProjectSection
            team={singleTeamTab}
            teamRecord={
              workspaceTeams.find((record) => record.name === singleTeamTab) ?? null
            }
            items={filtered}
            employees={employees}
            canEditStatus={!!access?.canManageProjects}
            canManageTeam={isAdmin}
            emptyMessage={
              isAssignedProjectsOnly
                ? "No projects assigned to you yet."
                : "No projects for this team yet."
            }
            onStatusChange={updateProjectStatus}
            onRenameTeam={handleRenameTeam}
            onDeleteTeam={handleDeleteTeam}
            onTeamActionError={setTeamActionError}
            today={today}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
            <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
            <p className="font-medium text-foreground">No squad selected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Assign a team on your account or pick a squad tab to view projects.
            </p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function TeamProjectSection({
  team,
  teamRecord,
  items,
  employees,
  canEditStatus,
  canManageTeam,
  onStatusChange,
  onRenameTeam,
  onDeleteTeam,
  onTeamActionError,
  emptyMessage,
  today,
}: {
  team: TeamName;
  teamRecord: TeamDTO | null;
  items: Project[];
  employees: ReturnType<typeof useAppState>["employees"];
  canEditStatus: boolean;
  canManageTeam: boolean;
  emptyMessage: string;
  onStatusChange: (project: Project, status: ProjectStatus) => Promise<void>;
  onRenameTeam: (team: TeamDTO, nextName: string) => Promise<void>;
  onDeleteTeam: (team: TeamDTO) => Promise<void>;
  onTeamActionError: (message: string | null) => void;
  today: Date;
}) {
  const completion = teamCompletionPercentage(items);

  return (
    <Card className="overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)]">
      <CardHeader className="border-b border-border/60 bg-muted/15 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 bg-background/80 p-3 shadow-sm">
              {renderTeamIcon(team, "h-5 w-5 text-primary")}
            </div>
            <div className="space-y-1">
              <CardTitle className="text-lg">
                {team === ALL_PROJECTS_SECTION
                  ? "All projects"
                  : team === UNASSIGNED_PROJECTS_SECTION
                    ? "Unassigned projects"
                    : teamTabLabel(team)}
              </CardTitle>
              <CardDescription>
                {team === ALL_PROJECTS_SECTION
                  ? `Full portfolio from MongoDB — ${items.length} project${items.length === 1 ? "" : "s"}`
                  : team === UNASSIGNED_PROJECTS_SECTION
                    ? "Projects with no squad or unknown squad — edit project teams to fix"
                    : `${items.length} project${items.length === 1 ? "" : "s"} • ${completion}% completed`}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canManageTeam && teamRecord ? (
              <TeamActionsMenu
                team={teamRecord}
                onRename={async (record, nextName) => {
                  onTeamActionError(null);
                  try {
                    await onRenameTeam(record, nextName);
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : "Could not update team.";
                    onTeamActionError(message);
                    throw error;
                  }
                }}
                onDelete={async (record) => {
                  onTeamActionError(null);
                  try {
                    await onDeleteTeam(record);
                  } catch (error) {
                    const message =
                      error instanceof Error ? error.message : "Could not delete team.";
                    onTeamActionError(message);
                    throw error;
                  }
                }}
              />
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        <ProjectLinkList
          items={items}
          employees={employees}
          canEditStatus={canEditStatus}
          emptyMessage={emptyMessage}
          onStatusChange={onStatusChange}
          today={today}
        />
      </CardContent>
    </Card>
  );
}

function ProjectLinkList({
  items,
  employees,
  canEditStatus,
  emptyMessage,
  onStatusChange,
  today,
}: {
  items: Project[];
  employees: ReturnType<typeof useAppState>["employees"];
  canEditStatus: boolean;
  emptyMessage: string;
  onStatusChange: (project: Project, status: ProjectStatus) => Promise<void>;
  today: Date;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-6 py-12 text-center">
        <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
        <p className="font-medium text-foreground">{emptyMessage}</p>
        {canEditStatus ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Create a project to populate this workspace section.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((project) => {
        const priority = projectPriority(project, today);
        const members = employees.filter((employee) => project.memberIds.includes(employee.id));
        const progress = projectProgressPercent(project, today);

        return (
          <li key={project.id} className="min-h-0">
            <div className="group flex h-full flex-col rounded-2xl border border-border/60 bg-background/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:bg-background hover:shadow-sm">
              <Link href={`/projects/${project.slug}`} className="min-w-0 flex-1 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="line-clamp-2 text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {project.name}
                    </p>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {project.teams.length === 0 ? (
                      <Badge
                        variant="outline"
                        className="rounded-full bg-muted/35 text-[10px] font-medium"
                      >
                        Unassigned
                      </Badge>
                    ) : (
                      project.teams.map((squad) => (
                        <Badge
                          key={squad}
                          variant="outline"
                          className="rounded-full bg-muted/35 text-[10px] font-medium"
                        >
                          {teamTabLabel(squad)}
                        </Badge>
                      ))
                    )}
                    <div
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold",
                        priority.toneClass,
                      )}
                    >
                      {priority.label}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    Due {formatProjectDate(project.lastDate, { month: "short", day: "numeric" })}
                  </span>
                  <span>{relativeProjectDeadline(project.lastDate, today)}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users2 className="h-3.5 w-3.5 shrink-0" />
                    {members.length === 0
                      ? "No members assigned"
                      : `${members.length} member${members.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/70">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        project.status === "Completed"
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : project.status === "In Progress"
                            ? "bg-gradient-to-r from-primary via-indigo-500 to-cyan-400"
                            : "bg-gradient-to-r from-slate-400 to-slate-300",
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
                <ProjectStatusSelect
                  value={project.status}
                  canEdit={canEditStatus}
                  onChange={(status) => onStatusChange(project, status)}
                />

                <div className="flex items-center gap-3">
                  <MemberAvatarStack members={members} />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-2xl border-border/70 bg-background/80 shadow-sm"
                    asChild
                  >
                    <Link href={`/projects/${project.slug}`} aria-label={`Open ${project.name}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberAvatarStack({
  members,
}: {
  members: ReturnType<typeof useAppState>["employees"];
}) {
  if (members.length === 0) {
    return (
      <div className="rounded-full border border-border/60 bg-muted/25 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
        Unassigned
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {members.slice(0, 3).map((member) => (
          <Avatar key={member.id} className="h-8 w-8 border-2 border-background ring-0">
            <AvatarImage src={member.imageUrl} alt={member.name} />
            <AvatarFallback>{profileInitials(member.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      {members.length > 3 && (
        <span className="ml-2 text-[11px] font-medium text-muted-foreground">
          +{members.length - 3}
        </span>
      )}
    </div>
  );
}

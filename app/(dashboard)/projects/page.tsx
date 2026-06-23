"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleCheckBig,
  Cloud,
  Code2,
  FolderKanban,
  Layers3,
  Palette,
  Server,
  Users2,
  Wrench,
  X,
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
import { CreateTeamTrigger } from "@/components/features/create-team-trigger";
import { useTeamAssignableAccounts } from "@/components/features/use-team-assignable-accounts";
import { accountsById, type TeamAssignableAccount } from "@/lib/team-assignees";
import { TeamActionsMenu } from "@/components/features/team-actions-menu";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import {
  formatProjectDate,
  isProjectDelayed,
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
import { registerTeamUpdatedHandler } from "@/lib/projects-team-panel";
import { teamTabLabel } from "@/lib/team-utils";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { Project, ProjectStatus, TeamName } from "@/types";
import type { TeamDTO } from "@/models";
import { profileInitials } from "@/lib/profile-image";

const ALL_TAB = "All";

type ProjectsToast = {
  title: string;
  description?: string;
};

function useProjectsToast(durationMs = 2000) {
  const [toast, setToast] = React.useState<ProjectsToast | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const showToast = React.useCallback(
    (next: ProjectsToast) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast(next);
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimerRef.current = null;
      }, durationMs);
    },
    [durationMs],
  );

  React.useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const dismissToast = React.useCallback(() => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  return { toast, showToast, dismissToast };
}

function ProjectsToastBanner({
  toast,
  onDismiss,
}: {
  toast: ProjectsToast | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
      <div className="rounded-2xl border border-emerald-500/30 bg-card p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-500/10 p-2 text-emerald-600">
            <CircleCheckBig className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">{toast.title}</p>
            {toast.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{toast.description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            onClick={onDismiss}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function useTabRailScroll(
  tabRailRef: React.RefObject<HTMLDivElement | null>,
  teamCount: number,
  activeTab: string,
) {
  const [scrollState, setScrollState] = React.useState({
    overflow: false,
    canLeft: false,
    canRight: false,
  });

  const updateScrollState = React.useCallback(() => {
    const element = tabRailRef.current;
    if (!element) return;

    const overflow = element.scrollWidth > element.clientWidth + 1;
    setScrollState({
      overflow,
      canLeft: overflow && element.scrollLeft > 1,
      canRight: overflow && element.scrollLeft + element.clientWidth < element.scrollWidth - 1,
    });
  }, [tabRailRef]);

  React.useEffect(() => {
    updateScrollState();
    const element = tabRailRef.current;
    if (!element) return;

    const frame = window.requestAnimationFrame(updateScrollState);
    element.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    const rail = element.firstElementChild;
    if (rail) resizeObserver.observe(rail);

    return () => {
      window.cancelAnimationFrame(frame);
      element.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [tabRailRef, updateScrollState, teamCount, activeTab]);

  return scrollState;
}

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
    access,
    user,
    teamNames,
    workspaceTeams,
    isAdmin,
    employees,
    refreshData,
    dataLoading,
    dataSummary,
    deleteWorkspaceTeam,
  } = useAppState();
  const { accounts: teamAssignableAccounts } = useTeamAssignableAccounts(isAdmin);
  const teamAccountById = React.useMemo(
    () => accountsById(teamAssignableAccounts),
    [teamAssignableAccounts],
  );
  const [tab, setTab] = React.useState<string>(ALL_TAB);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [teamActionError, setTeamActionError] = React.useState<string | null>(null);
  const tabRailRef = React.useRef<HTMLDivElement>(null);
  const { toast, showToast, dismissToast } = useProjectsToast(2000);
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

  const tabRailScroll = useTabRailScroll(tabRailRef, teamsToShow.length, tab);

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
      showToast({
        title: "Changes saved",
        description: `${project.name} status updated to ${nextStatus}.`,
      });
    },
    [refreshData, showToast],
  );

  React.useEffect(() => {
    return registerTeamUpdatedHandler((previous, updated) => {
      void (async () => {
        await refreshData();
        if (tab === previous.name) {
          setTab(updated.name);
        }
        showToast({
          title: "Changes saved",
          description: `Team updated: ${updated.name}.`,
        });
      })();
    });
  }, [refreshData, showToast, tab]);

  React.useEffect(() => {
    if (tab === ALL_TAB) return;
    if (!teamNames.includes(tab)) {
      setTab(ALL_TAB);
    }
  }, [tab, teamNames]);

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
      className="space-y-5"
    >
      <ProjectsToastBanner toast={toast} onDismiss={dismissToast} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isBroadViewer ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {tabRailScroll.overflow ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-9 w-9 shrink-0 rounded-xl border-border/60 bg-background/80 shadow-sm sm:inline-flex"
                onClick={() => tabRailRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
                disabled={!tabRailScroll.canLeft}
                aria-label="Scroll team filters left"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}

            <div ref={tabRailRef} className="min-w-0 flex-1 overflow-x-auto scroll-smooth pb-0.5">
              <TabsList className="inline-flex h-auto min-w-max flex-nowrap items-center gap-1 rounded-xl border border-border/60 bg-muted/30 p-1 shadow-none">
                <TabsTrigger
                  value={ALL_TAB}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-500 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
                >
                  All teams
                </TabsTrigger>
                {teamsToShow.map((team) => (
                  <TabsTrigger
                    key={team}
                    value={team}
                    className="rounded-lg px-3.5 py-2 text-sm font-medium text-muted-foreground transition-all duration-500 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=inactive]:hover:text-foreground/80"
                  >
                    {teamTabLabel(team)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {tabRailScroll.overflow ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="hidden h-9 w-9 shrink-0 rounded-xl border-border/60 bg-background/80 shadow-sm sm:inline-flex"
                onClick={() => tabRailRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
                disabled={!tabRailScroll.canRight}
                aria-label="Scroll team filters right"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Team projects</p>
            <p className="truncate text-lg font-semibold tracking-tight text-foreground">
              {user?.team ? teamTabLabel(user.team) : "Assigned projects"}
            </p>
          </div>
        )}

        {(isAdmin || access?.canManageProjects) && (
          <div className="flex shrink-0 justify-end gap-2">
            {isAdmin && <CreateTeamTrigger />}
            {access?.canManageProjects && (
              <Button
                asChild
                className="h-11 rounded-2xl px-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <Link href="/projects/new">Create project</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {teamActionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {teamActionError}
        </div>
      )}

      {statusError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
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
            teamAccountById={teamAccountById}
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
            teamAccountById={teamAccountById}
            onDeleteTeam={handleDeleteTeam}
            onTeamActionError={setTeamActionError}
            today={today}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center">
            <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
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
  teamAccountById,
  onDeleteTeam,
  onTeamActionError,
  emptyMessage,
  today,
}: {
  team: TeamName;
  teamRecord: TeamDTO | null;
  items: Project[];
  employees: ReturnType<typeof useAppState>["employees"];
  teamAccountById: Map<string, TeamAssignableAccount>;
  canEditStatus: boolean;
  canManageTeam: boolean;
  emptyMessage: string;
  onStatusChange: (project: Project, status: ProjectStatus) => Promise<void>;
  onDeleteTeam: (team: TeamDTO) => Promise<void>;
  onTeamActionError: (message: string | null) => void;
  today: Date;
}) {
  const completion = teamCompletionPercentage(items);
  const overdueCount = items.filter((project) => isProjectDelayed(project, today)).length;
  const teamLead = teamRecord?.teamLeadId
    ? teamAccountById.get(teamRecord.teamLeadId)
    : null;
  const teamManager = teamRecord?.teamManagerId
    ? teamAccountById.get(teamRecord.teamManagerId)
    : null;

  return (
    <Card className="overflow-hidden border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
      <CardHeader className="space-y-0 border-b border-border/40 px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/30">
              {renderTeamIcon(team, "h-4 w-4 text-foreground/70")}
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
                {team === ALL_PROJECTS_SECTION
                  ? "All projects"
                  : team === UNASSIGNED_PROJECTS_SECTION
                    ? "Unassigned projects"
                    : teamTabLabel(team)}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {team === ALL_PROJECTS_SECTION
                  ? `Full portfolio from MongoDB — ${items.length} project${items.length === 1 ? "" : "s"}`
                  : team === UNASSIGNED_PROJECTS_SECTION
                    ? "Projects with no squad or unknown squad — edit project teams to fix"
                    : `${items.length} project${items.length === 1 ? "" : "s"} • ${completion}% completed`}
              </CardDescription>
              {teamRecord && team !== ALL_PROJECTS_SECTION && team !== UNASSIGNED_PROJECTS_SECTION ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {teamRecord.code ? (
                    <Badge
                      variant="outline"
                      className="rounded-md border-border/60 bg-background/80 px-2 py-0.5 font-mono text-[10px] font-medium"
                    >
                      {teamRecord.code}
                    </Badge>
                  ) : null}
                  {teamLead ? (
                    <span className="text-[11px] text-muted-foreground">
                      Lead: <span className="font-medium text-foreground">{teamLead.name}</span>
                    </span>
                  ) : null}
                  {teamManager ? (
                    <span className="text-[11px] text-muted-foreground">
                      Manager:{" "}
                      <span className="font-medium text-foreground">{teamManager.name}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {items.length > 0 && (
              <div className="hidden items-center gap-1.5 sm:flex">
                <Badge variant="outline" className="rounded-md border-border/60 bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                  {items.length} total
                </Badge>
                <Badge variant="outline" className="rounded-md border-border/60 bg-background/80 px-2 py-0.5 text-[11px] font-medium">
                  {completion}% done
                </Badge>
                {overdueCount > 0 && (
                  <Badge className="rounded-md border-transparent bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-destructive/10">
                    {overdueCount} overdue
                  </Badge>
                )}
              </div>
            )}
            {canManageTeam && teamRecord ? (
              <TeamActionsMenu
                team={teamRecord}
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
      <CardContent className="p-3 sm:p-4">
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

function progressBarClasses(status: Project["status"]) {
  if (status === "Completed") {
    return "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]";
  }
  if (status === "In Progress") {
    return "bg-gradient-to-r from-primary via-indigo-500 to-violet-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]";
  }
  return "bg-gradient-to-r from-slate-400 to-slate-300";
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
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-10 text-center">
        <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
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
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {items.map((project) => {
        const priority = projectPriority(project, today);
        const members = employees.filter((employee) => project.memberIds.includes(employee.id));
        const progress = projectProgressPercent(project, today);
        const overdue = isProjectDelayed(project, today);

        return (
          <li key={project.id} className="min-h-0">
            <div
              className={cn(
                "group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card transition-all duration-motion ease-motion hover:-translate-y-0.5 hover:shadow-md",
                overdue
                  ? "border-destructive/25 bg-destructive/[0.02] shadow-sm hover:border-destructive/35"
                  : "border-border/50 shadow-sm hover:border-border/80",
              )}
            >
              <Link href={`/projects/${project.slug}`} className="flex min-w-0 flex-1 flex-col p-4 pb-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div
                    className={cn(
                      "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      priority.toneClass,
                    )}
                  >
                    {priority.label}
                  </div>
                  {overdue && (
                    <Badge className="rounded-md border-transparent bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive hover:bg-destructive/10">
                      Overdue
                    </Badge>
                  )}
                </div>

                <div className="mb-3 flex items-start gap-2">
                  <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug tracking-tight text-foreground transition-colors duration-500 group-hover:text-primary">
                    {project.name}
                  </h3>
                  <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 opacity-0 transition-all duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100" />
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  {project.teams.length === 0 ? (
                    <Badge
                      variant="secondary"
                      className="rounded-md border-0 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      Unassigned
                    </Badge>
                  ) : (
                    project.teams.map((squad) => (
                      <Badge
                        key={squad}
                        variant="secondary"
                        className="rounded-md border-0 bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                      >
                        {teamTabLabel(squad)}
                      </Badge>
                    ))
                  )}
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      overdue && "font-medium text-destructive",
                    )}
                  >
                    <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                    Due {formatProjectDate(project.lastDate, { month: "short", day: "numeric" })}
                  </span>
                  <span className={cn(overdue && "font-medium text-destructive/90")}>
                    {relativeProjectDeadline(project.lastDate, today)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users2 className="h-3.5 w-3.5 shrink-0" />
                    {members.length === 0
                      ? "No members assigned"
                      : `${members.length} member${members.length === 1 ? "" : "s"}`}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Progress
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-foreground">{progress}%</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out",
                        progressBarClasses(project.status),
                      )}
                      style={{ width: `${Math.max(progress, progress > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              </Link>

              <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/40 px-4 py-3">
                <ProjectStatusSelect
                  value={project.status}
                  canEdit={canEditStatus}
                  onChange={(status) => onStatusChange(project, status)}
                />

                <div className="flex items-center gap-2.5">
                  <MemberAvatarStack members={members} />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-lg border-border/60 bg-background/80 shadow-sm transition-all duration-500 hover:border-primary/30 hover:bg-primary/5"
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
      <div className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
        Unassigned
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {members.slice(0, 3).map((member) => (
          <Avatar
            key={member.id}
            className="h-7 w-7 border-2 border-background ring-1 ring-border/40 transition-transform duration-500 group-hover:scale-105"
          >
            <AvatarImage src={member.imageUrl} alt={member.name} />
            <AvatarFallback className="text-[10px]">{profileInitials(member.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      {members.length > 3 && (
        <span className="ml-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
          +{members.length - 3}
        </span>
      )}
    </div>
  );
}

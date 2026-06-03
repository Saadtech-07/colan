"use client";

import * as React from "react";
import { CalendarClock, Loader2, Save, Search, Users2, Workflow } from "lucide-react";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import { TeamMultiSelect } from "@/components/features/team-multi-select";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatProjectDate } from "@/lib/project-ui";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";
import type { Employee, ProjectDetail, ProjectManagerSummary, ProjectStatus, TeamName } from "@/types";

type Props = {
  project: ProjectDetail;
  teamRoster: Employee[];
  canEdit: boolean;
  lockedTeam?: TeamName;
  onSaved: (detail: ProjectDetail) => void;
};

export function ProjectDetailEditor({
  project,
  teamRoster,
  canEdit,
  lockedTeam,
  onSaved,
}: Props) {
  const { teamNames } = useAppState();
  const [name, setName] = React.useState(project.name);
  const [clientName, setClientName] = React.useState(project.clientName ?? "");
  const [projectManagerId, setProjectManagerId] = React.useState(
    project.projectManagerId ?? "",
  );
  const [teams, setTeams] = React.useState<TeamName[]>(project.teams);
  const [assignedDate, setAssignedDate] = React.useState(project.assignedDate);
  const [lastDate, setLastDate] = React.useState(project.lastDate);
  const [status, setStatus] = React.useState<ProjectStatus>(project.status);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [memberIds, setMemberIds] = React.useState<string[]>(project.memberIds);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [projectManagers, setProjectManagers] = React.useState<ProjectManagerSummary[]>([]);
  const [loadingProjectManagers, setLoadingProjectManagers] = React.useState(false);

  React.useEffect(() => {
    if (!canEdit) return;

    let cancelled = false;
    void (async () => {
      setLoadingProjectManagers(true);
      try {
        const res = await fetch("/api/projects/project-managers", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ProjectManagerSummary[];
        if (!cancelled) setProjectManagers(data);
      } finally {
        if (!cancelled) setLoadingProjectManagers(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const projectManagerOptions = React.useMemo(() => {
    const options = [...projectManagers];
    const selected = project.projectManager;
    if (
      selected &&
      !options.some((manager) => manager.id === selected.id)
    ) {
      options.unshift(selected);
    }
    return options;
  }, [project.projectManager, projectManagers]);

  const assignedTeams = lockedTeam ? [lockedTeam] : teams;
  const rosterForTeam = teamRoster.filter((e) =>
    assignedTeams.includes(e.team),
  );
  const selectedMembers = rosterForTeam.filter((member) =>
    memberIds.includes(member.id),
  );

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    if (assignedTeams.length === 0) {
      setError("Select at least one team.");
      return;
    }
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    if (!projectManagerId) {
      setError("Project manager is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          clientName: clientName.trim(),
          projectManagerId,
          teams: assignedTeams,
          assignedDate,
          lastDate,
          status,
          description: description.trim() || undefined,
          memberIds,
        }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      onSaved((await res.json()) as ProjectDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Project overview</CardTitle>
            <CardDescription>
              Read-only workspace view for description, squad ownership, and timeline context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            {project.clientName ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Client
                </p>
                <p className="text-sm font-medium text-foreground">{project.clientName}</p>
              </div>
            ) : null}

            {project.projectManager ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Project manager
                </p>
                <p className="text-sm font-medium text-foreground">
                  {project.projectManager.name}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Description
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {description || "No description yet."}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <OverviewStat
                icon={<Workflow className="h-4 w-4 text-primary" />}
                label="Teams"
                value={project.teams.join(", ")}
              />
              <OverviewStat
                icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
                label="Schedule"
                value={`${formatProjectDate(project.assignedDate)} to ${formatProjectDate(project.lastDate)}`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle>Workspace summary</CardTitle>
              <CardDescription>Key project information visible in this role.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-6">
              <OverviewPill label="Status">
                <ProjectStatusSelect value={project.status} canEdit={false} />
              </OverviewPill>
              <OverviewPill label="Team members">
                <span className="text-sm font-semibold text-foreground">
                  {project.members.length}
                </span>
              </OverviewPill>
            </CardContent>
          </Card>

          <Card
            id="project-members"
            className="border-border/70 bg-background/75 backdrop-blur-xl"
          >
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle>Assigned members</CardTitle>
              <CardDescription>Current contributors on this project.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {project.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members assigned.</p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {project.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/15 p-4"
                    >
                      <Avatar className="h-10 w-10 ring-1 ring-border/60">
                        <AvatarImage src={member.imageUrl} alt={member.name} />
                        <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {member.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {member.role} · {member.team}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {error && (
        <p className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-sm">
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)] xl:grid-rows-[auto_minmax(480px,1fr)]">
        <Card
          id="project-details"
          className="border-border/70 bg-background/75 backdrop-blur-xl xl:row-start-1 xl:col-start-1"
        >
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Project details</CardTitle>
            <CardDescription>
              Capture the project title, client account, and assigned manager for this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <RequiredFieldLabel htmlFor="p-name">Project name</RequiredFieldLabel>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className="h-11 rounded-2xl border-border/70 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <RequiredFieldLabel htmlFor="p-client">Client name</RequiredFieldLabel>
              <p className="text-xs text-muted-foreground">
                The client or account this project is being delivered for.
              </p>
              <Input
                id="p-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                className="h-11 rounded-2xl border-border/70 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <RequiredFieldLabel htmlFor="p-manager">Project manager</RequiredFieldLabel>
              <p className="text-xs text-muted-foreground">
                Select the project manager responsible for delivery oversight.
              </p>
              <Select
                value={projectManagerId || undefined}
                onValueChange={setProjectManagerId}
                disabled={loadingProjectManagers || projectManagerOptions.length === 0}
              >
                <SelectTrigger
                  id="p-manager"
                  className="h-11 rounded-2xl border-border/70 bg-background/80"
                >
                  <SelectValue
                    placeholder={
                      loadingProjectManagers
                        ? "Loading project managers…"
                        : projectManagerOptions.length === 0
                          ? "No project managers available"
                          : "Select project manager"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-border/60">
                  {projectManagerOptions.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingProjectManagers && projectManagerOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Create a Project Manager account in App Users to assign one here.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card
          id="project-schedule"
          className="border-border/70 bg-background/75 backdrop-blur-xl xl:row-start-1 xl:col-start-2"
        >
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Status and schedule</CardTitle>
            <CardDescription>
              Keep delivery status and timeline aligned with the latest plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label>Status</Label>
              <ProjectStatusSelect
                value={status}
                canEdit
                onChange={(nextStatus) => setStatus(nextStatus as ProjectStatus)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-start">Assigned date</Label>
                <Input
                  id="p-start"
                  type="date"
                  value={assignedDate}
                  onChange={(e) => setAssignedDate(e.target.value)}
                  className="h-11 rounded-2xl border-border/70 bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-end">Last date</Label>
                <Input
                  id="p-end"
                  type="date"
                  value={lastDate}
                  onChange={(e) => setLastDate(e.target.value)}
                  className="h-11 rounded-2xl border-border/70 bg-background/80"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <OverviewStat
                icon={<Workflow className="h-4 w-4 text-primary" />}
                label="Assigned teams"
                value={`${assignedTeams.length}`}
              />
              <OverviewStat
                icon={<Users2 className="h-4 w-4 text-primary" />}
                label="Selected members"
                value={`${selectedMembers.length}`}
              />
              <OverviewStat
                icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
                label="Current range"
                value={`${formatProjectDate(assignedDate)} to ${formatProjectDate(lastDate)}`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex h-full min-h-0 flex-col gap-6 xl:row-start-2 xl:col-start-1 xl:min-h-[480px]">
          <Card className="shrink-0 border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle>
                Teams
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({assignedTeams.length} selected)
                </span>
              </CardTitle>
              <CardDescription>
                {lockedTeam
                  ? "This workspace is locked to your assigned team."
                  : "Select every squad responsible for delivery on this project."}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <TeamMultiSelect
                value={teams}
                onChange={setTeams}
                options={teamNames}
                lockedTeam={lockedTeam}
              />
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="shrink-0 border-b border-border/60 pb-4">
              <CardTitle>Description</CardTitle>
              <CardDescription>
                Document goals, scope, milestones, and delivery notes for your squads.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col p-6 pt-4">
              <Textarea
                id="p-desc"
                aria-label="Project description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Goals, scope, milestones, blockers, and delivery notes…"
                className="h-0 min-h-[120px] flex-1 resize-none rounded-2xl border-border/70 bg-background/80 xl:min-h-0"
              />
            </CardContent>
          </Card>
        </div>

        <AssignTeamMembersPanel
          className="min-h-[420px] xl:row-start-2 xl:col-start-2 xl:h-full xl:min-h-0"
          rosterForTeam={rosterForTeam}
          assignedTeams={assignedTeams}
          memberIds={memberIds}
          selectedMembersCount={selectedMembers.length}
          onToggleMember={toggleMember}
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="h-11 rounded-2xl px-5 shadow-sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>
    </section>
  );
}

function RequiredFieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="ml-0.5 text-destructive" aria-hidden="true">
        *
      </span>
    </Label>
  );
}

function shortTeamName(team: TeamName) {
  return team.replace(" Team", "");
}

function AssignTeamMembersPanel({
  rosterForTeam,
  assignedTeams,
  memberIds,
  selectedMembersCount,
  onToggleMember,
  className,
}: {
  rosterForTeam: Employee[];
  assignedTeams: TeamName[];
  memberIds: string[];
  selectedMembersCount: number;
  onToggleMember: (id: string) => void;
  className?: string;
}) {
  const [search, setSearch] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState<"all" | TeamName>("all");

  const assignedTeamsKey = assignedTeams.join("\0");

  React.useEffect(() => {
    setTeamFilter("all");
  }, [assignedTeamsKey]);

  const filteredRoster = rosterForTeam.filter((member) => {
    if (teamFilter !== "all" && member.team !== teamFilter) return false;
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      member.name.toLowerCase().includes(query) ||
      member.role.toLowerCase().includes(query)
    );
  });

  return (
    <Card
      id="project-members"
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border-border/70 bg-background/75 backdrop-blur-xl",
        className,
      )}
    >
      <CardHeader className="shrink-0 border-b border-border/60 pb-4">
        <CardTitle>Assign team members</CardTitle>
        <CardDescription>
          Search and filter contributors from your selected teams.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        <div className="shrink-0 space-y-4 border-b border-border/60 px-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="member-search" className="text-sm">
              Search Employee
            </Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="member-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee name..."
                className="h-10 rounded-xl border-border/70 bg-background/80 pl-9"
              />
            </div>
          </div>

          {assignedTeams.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">Filters</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={teamFilter === "all" ? "default" : "outline"}
                  onClick={() => setTeamFilter("all")}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  All
                </Button>
                {assignedTeams.map((team) => (
                  <Button
                    key={team}
                    type="button"
                    size="sm"
                    variant={teamFilter === team ? "default" : "outline"}
                    onClick={() => setTeamFilter(team)}
                    className="h-8 rounded-full px-3 text-xs"
                  >
                    {shortTeamName(team)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm font-medium text-foreground">
            Assigned Members ({selectedMembersCount})
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {rosterForTeam.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              No eligible members in the selected team scope yet.
            </p>
          ) : filteredRoster.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
              No employees match your search or filter.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filteredRoster.map((member) => {
                const selected = memberIds.includes(member.id);
                return (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => onToggleMember(member.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected
                          ? "border-primary/30 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15"
                          : "border-border/60 bg-background/80 hover:border-primary/20 hover:bg-muted/20 hover:shadow-sm",
                      )}
                    >
                      <Avatar className="h-10 w-10 shrink-0 ring-1 ring-border/60">
                        <AvatarImage src={member.imageUrl} alt={member.name} />
                        <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div>
                          <p className="truncate text-sm font-semibold text-foreground">
                            {member.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {member.role}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        >
                          {shortTeamName(member.team)}
                        </Badge>
                      </div>
                      <Badge
                        variant={selected ? "default" : "outline"}
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                          !selected && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {selected ? "Assigned" : "Available"}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="text-sm font-semibold leading-6 text-foreground">{value}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
          {icon}
        </div>
      </div>
    </div>
  );
}

function OverviewPill({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

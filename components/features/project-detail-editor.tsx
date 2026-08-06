"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Save, Search, Users2, Workflow } from "lucide-react";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import {
  ProjectFormField,
  projectFieldClassName,
  projectFormLabelClassName,
  projectTextareaClassName,
  TeamChipSelect,
} from "@/components/features/project-form-shared";
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
import { fetchProjectManagersOnce } from "@/lib/workspace-api-client";
import { useAppState } from "@/providers/app-state";
import type { Employee, ProjectDetail, ProjectManagerSummary, ProjectStatus, TeamName } from "@/types";

type Props = {
  project: ProjectDetail;
  teamRoster: Employee[];
  canEdit: boolean;
  lockedTeam?: TeamName;
  embedTasksInOverview?: boolean;
  onSaved: (detail: ProjectDetail) => void;
  tasksPanel?: React.ReactNode;
};

export function ProjectDetailEditor({
  project,
  teamRoster,
  canEdit,
  lockedTeam,
  embedTasksInOverview = false,
  onSaved,
  tasksPanel,
}: Props) {
  const router = useRouter();
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
        const data = await fetchProjectManagersOnce<ProjectManagerSummary[]>();
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

            {embedTasksInOverview && tasksPanel ? (
              <div className="border-t border-border/60 pt-6">{tasksPanel}</div>
            ) : null}
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

          {!embedTasksInOverview ? tasksPanel : null}
        </div>
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
      <div className="p-6 sm:p-8">
        {error ? (
          <p className="mb-7 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
            {error}
          </p>
        ) : null}

        <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <div className="space-y-7">
            <ProjectFormField id="p-name" label="Project name" required>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter project name"
                className={projectFieldClassName}
              />
            </ProjectFormField>

            <ProjectFormField id="p-client" label="Client name" required>
              <Input
                id="p-client"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                className={projectFieldClassName}
              />
            </ProjectFormField>

            <ProjectFormField id="p-manager" label="Project manager" required>
              <Select
                value={projectManagerId || undefined}
                onValueChange={setProjectManagerId}
                disabled={loadingProjectManagers || projectManagerOptions.length === 0}
              >
                <SelectTrigger id="p-manager" className={projectFieldClassName}>
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
                <SelectContent className="rounded-lg border-border/60">
                  {projectManagerOptions.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ProjectFormField>

            <ProjectFormField label="Teams" required>
              <TeamChipSelect
                value={teams}
                onChange={setTeams}
                options={teamNames}
                lockedTeam={lockedTeam}
              />
            </ProjectFormField>
          </div>

          <div className="space-y-7 lg:border-l lg:border-border/35 lg:pl-12">
            <ProjectFormField label="Status">
              <ProjectStatusSelect
                value={status}
                canEdit
                className={cn(projectFieldClassName, "min-w-[160px] rounded-lg text-sm font-normal")}
                onChange={(nextStatus) => setStatus(nextStatus as ProjectStatus)}
              />
            </ProjectFormField>

            <div className="grid gap-7 sm:grid-cols-2">
              <ProjectFormField id="p-start" label="Assigned date" required>
                <Input
                  id="p-start"
                  type="date"
                  value={assignedDate}
                  onChange={(e) => setAssignedDate(e.target.value)}
                  className={projectFieldClassName}
                />
              </ProjectFormField>
              <ProjectFormField id="p-end" label="Last date" required>
                <Input
                  id="p-end"
                  type="date"
                  value={lastDate}
                  onChange={(e) => setLastDate(e.target.value)}
                  className={projectFieldClassName}
                />
              </ProjectFormField>
            </div>

            <ProjectFormField id="p-desc" label="Description">
              <Textarea
                id="p-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief project summary…"
                rows={4}
                className={projectTextareaClassName}
              />
            </ProjectFormField>
          </div>
        </div>

        <div className="mt-10 border-t border-border/40 pt-8">
          <div className="grid items-start gap-x-12 gap-y-8 xl:grid-cols-2">
            <AssignTeamMembersPanel
              rosterForTeam={rosterForTeam}
              assignedTeams={assignedTeams}
              memberIds={memberIds}
              selectedMembersCount={selectedMembers.length}
              onToggleMember={toggleMember}
            />
            {tasksPanel ? tasksPanel : null}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-muted/10 px-6 py-4 sm:px-8">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/projects")}
          disabled={saving}
          className="h-10 rounded-lg px-5 text-[15px]"
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="h-10 rounded-lg px-5 text-[15px] shadow-sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save changes
        </Button>
      </div>
    </div>
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
}: {
  rosterForTeam: Employee[];
  assignedTeams: TeamName[];
  memberIds: string[];
  selectedMembersCount: number;
  onToggleMember: (id: string) => void;
}) {
  const [search, setSearch] = React.useState("");
  const [teamFilter, setTeamFilter] = React.useState<"all" | TeamName>("all");

  const assignedTeamsKey = assignedTeams.join("\0");

  React.useEffect(() => {
    setTeamFilter("all");
  }, [assignedTeamsKey]);

  const filteredRoster = rosterForTeam
    .filter((member) => {
      if (teamFilter !== "all" && member.team !== teamFilter) return false;
      const query = search.trim().toLowerCase();
      if (!query) return true;
      return (
        member.name.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const aSelected = memberIds.includes(a.id);
      const bSelected = memberIds.includes(b.id);
      if (aSelected !== bSelected) return aSelected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return (
    <div id="project-members" className="w-full min-w-0 space-y-5">
      <Label className={projectFormLabelClassName}>Assign team members</Label>

      <div className="space-y-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="member-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee name..."
            className={cn(projectFieldClassName, "pl-9")}
          />
        </div>

        {assignedTeams.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTeamFilter("all")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                teamFilter === "all"
                  ? "border-foreground/25 bg-foreground/5 text-foreground"
                  : "border-border/60 bg-muted/15 text-muted-foreground hover:bg-muted/30",
              )}
            >
              All
            </button>
            {assignedTeams.map((team) => (
              <button
                key={team}
                type="button"
                onClick={() => setTeamFilter(team)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  teamFilter === team
                    ? "border-foreground/25 bg-foreground/5 text-foreground"
                    : "border-border/60 bg-muted/15 text-muted-foreground hover:bg-muted/30",
                )}
              >
                {shortTeamName(team)}
              </button>
            ))}
          </div>
        ) : null}

        <p className={cn(projectFormLabelClassName, "normal-case tracking-normal")}>
          Assigned members ({selectedMembersCount})
        </p>
      </div>

      <div>
        {rosterForTeam.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No eligible members in the selected team scope yet.
          </p>
        ) : filteredRoster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No employees match your search or filter.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/55">
            <ul
              className="max-h-[min(420px,60vh)] divide-y divide-border/50 overflow-y-auto overscroll-contain"
              role="listbox"
              aria-label="Team members"
            >
              {filteredRoster.map((member) => {
                const selected = memberIds.includes(member.id);
                return (
                  <li key={member.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => onToggleMember(member.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20",
                        selected
                          ? "bg-foreground/[0.04]"
                          : "bg-background hover:bg-muted/25",
                      )}
                    >
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={member.imageUrl} alt={member.name} />
                        <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.role} · {shortTeamName(member.team)}
                        </p>
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
          </div>
        )}
      </div>
    </div>
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

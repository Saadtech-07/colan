"use client";

import * as React from "react";
import { CalendarClock, Loader2, Save, Users2, Workflow } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { formatProjectDate } from "@/lib/project-ui";
import { cn } from "@/lib/utils";
import { useAppState } from "@/providers/app-state";
import type { Employee, ProjectDetail, ProjectStatus, TeamName } from "@/types";

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
  const [teams, setTeams] = React.useState<TeamName[]>(project.teams);
  const [assignedDate, setAssignedDate] = React.useState(project.assignedDate);
  const [lastDate, setLastDate] = React.useState(project.lastDate);
  const [status, setStatus] = React.useState<ProjectStatus>(project.status);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [memberIds, setMemberIds] = React.useState<string[]>(project.memberIds);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const assignedTeams = lockedTeam ? [lockedTeam] : teams;
  const rosterForTeam = teamRoster.filter((e) =>
    assignedTeams.includes(e.team),
  );
  const selectedMembers = rosterForTeam.filter((member) =>
    memberIds.includes(member.id),
  );
  const selectedTeamLabel = lockedTeam
    ? lockedTeam
    : teams.map((team) => team.replace(" Team", "")).join(", ") ||
      "your selected teams";

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
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <Card
          id="project-details"
          className="border-border/70 bg-background/75 backdrop-blur-xl"
        >
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle>Project details</CardTitle>
            <CardDescription>
              Update the workspace title, description, and team ownership.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6">
            <div className="space-y-2">
              <Label htmlFor="p-name">Project name</Label>
              <Input
                id="p-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background/80"
              />
            </div>

            <div className="space-y-2">
              <Label>Teams</Label>
              <p className="text-xs text-muted-foreground">
                {lockedTeam
                  ? "This workspace is locked to your assigned team."
                  : "Select every squad responsible for delivery on this project."}
              </p>
              <TeamMultiSelect
                value={teams}
                onChange={setTeams}
                options={teamNames}
                lockedTeam={lockedTeam}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="p-desc">Description</Label>
              <Textarea
                id="p-desc"
                rows={8}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Goals, scope, milestones, blockers, and delivery notes…"
                className="rounded-2xl border-border/70 bg-background/80"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card
            id="project-schedule"
            className="border-border/70 bg-background/75 backdrop-blur-xl"
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

          <Card
            id="project-members"
            className="border-border/70 bg-background/75 backdrop-blur-xl"
          >
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle>Assign team members</CardTitle>
              <CardDescription>
                Select people from {selectedTeamLabel} working on this project.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              {rosterForTeam.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                  No eligible members in the selected team scope yet.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {rosterForTeam.map((member) => {
                    const selected = memberIds.includes(member.id);
                    return (
                      <li key={member.id}>
                        <button
                          type="button"
                          onClick={() => toggleMember(member.id)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selected
                              ? "border-primary/25 bg-primary/5 shadow-sm ring-1 ring-primary/20"
                              : "border-border/60 bg-background/80 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm",
                          )}
                        >
                          <Avatar className="h-10 w-10 ring-1 ring-border/60">
                            <AvatarImage src={member.imageUrl} alt={member.name} />
                            <AvatarFallback>{member.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {member.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.role} · {member.team}
                            </p>
                          </div>
                          <Badge
                            variant={selected ? "default" : "outline"}
                            className="rounded-full px-2.5 py-1 text-[11px]"
                          >
                            {selected ? "Assigned" : "Available"}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
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

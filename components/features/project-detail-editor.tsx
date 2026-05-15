"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TEAMS } from "@/lib/constants";
import type { Employee, ProjectDetail, ProjectStatus, TeamName } from "@/types";

const STATUSES: ProjectStatus[] = ["Yet To Start", "In Progress", "Completed"];

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
  const [name, setName] = React.useState(project.name);
  const [team, setTeam] = React.useState<TeamName>(project.team);
  const [assignedDate, setAssignedDate] = React.useState(project.assignedDate);
  const [lastDate, setLastDate] = React.useState(project.lastDate);
  const [status, setStatus] = React.useState<ProjectStatus>(project.status);
  const [description, setDescription] = React.useState(project.description ?? "");
  const [memberIds, setMemberIds] = React.useState<string[]>(project.memberIds);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(project.name);
    setTeam(project.team);
    setAssignedDate(project.assignedDate);
    setLastDate(project.lastDate);
    setStatus(project.status);
    setDescription(project.description ?? "");
    setMemberIds(project.memberIds);
  }, [project]);

  const rosterForTeam = teamRoster.filter((e) => e.team === (lockedTeam ?? team));

  const toggleMember = (id: string) => {
    setMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          team: lockedTeam ?? team,
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
      <section className="space-y-6">
        <p className="text-sm text-muted-foreground">{description || "No description yet."}</p>
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Team on this project
          </h3>
          {project.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members assigned.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {project.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.imageUrl} alt={m.name} />
                    <AvatarFallback>{m.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium leading-tight">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="p-name">Project name</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Team</Label>
          {lockedTeam ? (
            <Input value={lockedTeam} readOnly className="bg-muted" />
          ) : (
            <Select value={team} onValueChange={(v) => setTeam(v as TeamName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEAMS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-start">Assigned date</Label>
          <Input
            id="p-start"
            type="date"
            value={assignedDate}
            onChange={(e) => setAssignedDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-end">Last date</Label>
          <Input
            id="p-end"
            type="date"
            value={lastDate}
            onChange={(e) => setLastDate(e.target.value)}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="p-desc">Description</Label>
          <Textarea
            id="p-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Goals, scope, and milestones…"
          />
        </div>
      </div>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Assign team members
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Select people from {lockedTeam ?? team} working on this project.
        </p>
        <ul className="flex flex-wrap gap-2">
          {rosterForTeam.map((e) => {
            const on = memberIds.includes(e.id);
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => toggleMember(e.id)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Badge variant={on ? "default" : "outline"} className="gap-1.5 py-1 pl-1 pr-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={e.imageUrl} alt="" />
                      <AvatarFallback className="text-[8px]">
                        {e.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    {e.name}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <Button type="button" onClick={save} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save changes
      </Button>
    </section>
  );
}

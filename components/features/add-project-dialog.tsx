"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Project, ProjectStatus, TeamName } from "@/types";
import { TEAMS } from "@/lib/constants";

type Props = {
  onCreate: (project: Omit<Project, "id" | "slug">) => void | Promise<void>;
  lockedTeam?: TeamName;
};

const STATUSES: ProjectStatus[] = ["Yet To Start", "In Progress", "Completed"];

export function AddProjectDialog({ onCreate, lockedTeam }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [team, setTeam] = React.useState<TeamName>(lockedTeam ?? "React Team");
  const [assignedDate, setAssignedDate] = React.useState("");
  const [lastDate, setLastDate] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("Yet To Start");
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const reset = () => {
    setName("");
    setTeam(lockedTeam ?? "React Team");
    setAssignedDate("");
    setLastDate("");
    setStatus("Yet To Start");
    setSubmitError(null);
    setIsSaving(false);
  };

  const submit = async () => {
    if (!name.trim() || !assignedDate || !lastDate) return;
    setSubmitError(null);
    setIsSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        team: lockedTeam ?? team,
        assignedDate,
        lastDate,
        status,
        memberIds: [],
      });
      reset();
      setOpen(false);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not create project");
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSubmitError(null);
          setIsSaving(false);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="shadow-sm transition-transform hover:-translate-y-0.5">
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            {lockedTeam
              ? `Create a project for ${lockedTeam}. Saved to MongoDB when configured.`
              : "Assign a project to a team. Saved to MongoDB when configured."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {submitError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {submitError}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Billing platform refresh"
            />
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="assigned">Assigned date</Label>
              <Input
                id="assigned"
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last">Last date</Label>
              <Input
                id="last"
                type="date"
                value={lastDate}
                onChange={(e) => setLastDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
            >
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
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

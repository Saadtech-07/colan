"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import { TeamMultiSelect } from "@/components/features/team-multi-select";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { Project, ProjectManagerSummary, ProjectStatus, TeamName } from "@/types";

type Props = {
  onCreate: (project: Omit<Project, "id" | "slug">) => Promise<Project>;
  teamOptions: TeamName[];
  lockedTeam?: TeamName;
};

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

export function AddProjectDialog({ onCreate, teamOptions, lockedTeam }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [clientName, setClientName] = React.useState("");
  const [projectManagerId, setProjectManagerId] = React.useState("");
  const [teams, setTeams] = React.useState<TeamName[]>(
    lockedTeam ? [lockedTeam] : ["React Team"],
  );
  const [assignedDate, setAssignedDate] = React.useState("");
  const [lastDate, setLastDate] = React.useState("");
  const [status, setStatus] = React.useState<ProjectStatus>("Yet To Start");
  const [description, setDescription] = React.useState("");
  const [projectManagers, setProjectManagers] = React.useState<ProjectManagerSummary[]>([]);
  const [loadingProjectManagers, setLoadingProjectManagers] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const assignedTeams = lockedTeam ? [lockedTeam] : teams;

  React.useEffect(() => {
    if (!open) return;

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
  }, [open]);

  const reset = () => {
    setName("");
    setClientName("");
    setProjectManagerId("");
    setTeams(lockedTeam ? [lockedTeam] : ["React Team"]);
    setAssignedDate("");
    setLastDate("");
    setStatus("Yet To Start");
    setDescription("");
    setSubmitError(null);
    setIsSaving(false);
  };

  const submit = async () => {
    if (!name.trim()) {
      setSubmitError("Project name is required.");
      return;
    }
    if (!clientName.trim()) {
      setSubmitError("Client name is required.");
      return;
    }
    if (!projectManagerId) {
      setSubmitError("Project manager is required.");
      return;
    }
    if (assignedTeams.length === 0) {
      setSubmitError("Select at least one team.");
      return;
    }
    if (!assignedDate || !lastDate) {
      setSubmitError("Assigned date and last date are required.");
      return;
    }

    setSubmitError(null);
    setIsSaving(true);
    try {
      const created = await onCreate({
        name: name.trim(),
        clientName: clientName.trim(),
        projectManagerId,
        teams: assignedTeams,
        assignedDate,
        lastDate,
        status,
        description: description.trim() || undefined,
        memberIds: [],
      });
      reset();
      setOpen(false);
      router.push(`/projects/${created.slug}`);
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
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 rounded-2xl px-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          Add Project
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92vh] w-[min(100vw-2rem,72rem)] max-w-none flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-[28px]">
        <DialogHeader className="shrink-0 space-y-2 border-b border-border/60 px-6 py-5">
          <DialogTitle className="text-xl">New project</DialogTitle>
          <DialogDescription>
            {lockedTeam
              ? `Create a project for ${lockedTeam}. You can assign team members after creation on the project workspace page.`
              : "Set up the full project workspace. Assign team members after creation on the project page."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {submitError && (
            <p className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {submitError}
            </p>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
            <div className="flex flex-col gap-6">
              <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle>Project details</CardTitle>
                  <CardDescription>
                    Capture the project title, client account, and assigned manager.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 p-6">
                  <div className="space-y-2">
                    <RequiredFieldLabel htmlFor="project-name">Project name</RequiredFieldLabel>
                    <Input
                      id="project-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Tommy platform rollout"
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <RequiredFieldLabel htmlFor="project-client">Client name</RequiredFieldLabel>
                    <p className="text-xs text-muted-foreground">
                      The client or account this project is being delivered for.
                    </p>
                    <Input
                      id="project-client"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Enter client name"
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>

                  <div className="space-y-2">
                    <RequiredFieldLabel htmlFor="project-manager">Project manager</RequiredFieldLabel>
                    <p className="text-xs text-muted-foreground">
                      Select the project manager responsible for delivery oversight.
                    </p>
                    <Select
                      value={projectManagerId || undefined}
                      onValueChange={setProjectManagerId}
                      disabled={loadingProjectManagers || projectManagers.length === 0}
                    >
                      <SelectTrigger
                        id="project-manager"
                        className="h-11 rounded-2xl border-border/70 bg-background/80"
                      >
                        <SelectValue
                          placeholder={
                            loadingProjectManagers
                              ? "Loading project managers…"
                              : projectManagers.length === 0
                                ? "No project managers available"
                                : "Select project manager"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border/60">
                        {projectManagers.map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!loadingProjectManagers && projectManagers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Create a Project Manager account in App Users first.
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
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
                    options={teamOptions}
                    lockedTeam={lockedTeam}
                  />
                </CardContent>
              </Card>

              <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
                <CardHeader className="border-b border-border/60 pb-4">
                  <CardTitle>Description</CardTitle>
                  <CardDescription>
                    Document goals, scope, milestones, and delivery notes for your squads.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-4">
                  <Textarea
                    id="project-description"
                    aria-label="Project description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Goals, scope, milestones, blockers, and delivery notes…"
                    className="min-h-[140px] resize-y rounded-2xl border-border/70 bg-background/80"
                  />
                </CardContent>
              </Card>
            </div>

            <Card
              id="project-schedule"
              className="h-fit border-border/70 bg-background/75 backdrop-blur-xl xl:sticky xl:top-0"
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
                    <RequiredFieldLabel htmlFor="assigned">Assigned date</RequiredFieldLabel>
                    <Input
                      id="assigned"
                      type="date"
                      value={assignedDate}
                      onChange={(e) => setAssignedDate(e.target.value)}
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <RequiredFieldLabel htmlFor="last">Last date</RequiredFieldLabel>
                    <Input
                      id="last"
                      type="date"
                      value={lastDate}
                      onChange={(e) => setLastDate(e.target.value)}
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
            className="h-11 rounded-2xl border-border/70 bg-background/80"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            className="h-11 rounded-2xl px-5 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

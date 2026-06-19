"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, Loader2, Plus } from "lucide-react";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import {
  ProjectFormField,
  projectFieldClassName,
  projectTextareaClassName,
  TeamChipSelect,
} from "@/components/features/project-form-shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Project, ProjectManagerSummary, ProjectStatus, TeamName } from "@/types";

type Props = {
  onCreate: (project: Omit<Project, "id" | "slug">) => Promise<Project>;
  teamOptions: TeamName[];
  lockedTeam?: TeamName;
  onCancel?: () => void;
};

export function CreateProjectForm({ onCreate, teamOptions, lockedTeam, onCancel }: Props) {
  const router = useRouter();
  const [createSuccessOpen, setCreateSuccessOpen] = React.useState(false);
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
  }, []);

  const returnToProjects = React.useCallback(() => {
    setCreateSuccessOpen(false);
    router.push("/projects");
  }, [router]);

  const handleCancel = React.useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push("/projects");
  }, [onCancel, router]);

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
      await onCreate({
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
      setCreateSuccessOpen(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not create project");
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
        <div className="p-6 sm:p-8">
          {submitError ? (
            <p className="mb-7 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[15px] text-destructive">
              {submitError}
            </p>
          ) : null}

          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <div className="space-y-7">
              <ProjectFormField id="project-name" label="Project name" required>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tommy platform rollout"
                  className={projectFieldClassName}
                />
              </ProjectFormField>

              <ProjectFormField id="project-client" label="Client name" required>
                <Input
                  id="project-client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter client name"
                  className={projectFieldClassName}
                />
              </ProjectFormField>

              <ProjectFormField id="project-manager" label="Project manager" required>
                <Select
                  value={projectManagerId || undefined}
                  onValueChange={setProjectManagerId}
                  disabled={loadingProjectManagers || projectManagers.length === 0}
                >
                  <SelectTrigger id="project-manager" className={projectFieldClassName}>
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
                  <SelectContent className="rounded-lg border-border/60">
                    {projectManagers.map((manager) => (
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
                  options={teamOptions}
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
                <ProjectFormField id="assigned" label="Assigned date" required>
                  <Input
                    id="assigned"
                    type="date"
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className={projectFieldClassName}
                  />
                </ProjectFormField>
                <ProjectFormField id="last" label="Last date" required>
                  <Input
                    id="last"
                    type="date"
                    value={lastDate}
                    onChange={(e) => setLastDate(e.target.value)}
                    className={projectFieldClassName}
                  />
                </ProjectFormField>
              </div>

              <ProjectFormField id="project-description" label="Description">
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief project summary…"
                  rows={4}
                  className={projectTextareaClassName}
                />
              </ProjectFormField>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border/50 bg-muted/10 px-6 py-4 sm:px-8">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-10 rounded-lg px-5 text-[15px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={isSaving}
            className="h-10 rounded-lg px-5 text-[15px] shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create project
          </Button>
        </div>
      </div>

      <Dialog
        open={createSuccessOpen}
        onOpenChange={(next) => {
          if (!next) returnToProjects();
        }}
      >
        <DialogContent className="max-w-sm rounded-[24px] border-border/70 bg-background/95 text-center shadow-2xl backdrop-blur-xl sm:max-w-md [&>button]:hidden">
          <DialogHeader className="items-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CircleCheckBig className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Project Created
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your new project has been added to Team Projects.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 sm:justify-center">
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-2xl px-6"
              onClick={returnToProjects}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

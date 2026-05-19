"use client";

import * as React from "react";
import { Briefcase, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { parseApiError } from "@/providers/app-state";
import {
  assignableProjectsForEmployee,
  getProjectsForEmployee,
  projectStatusVariant,
} from "@/lib/project-assignments";
import type { Employee, Project } from "@/types";

type Props = {
  employee: Employee;
  projects: Project[];
  canManage: boolean;
  canManageProject: (projectTeam: Project["team"]) => boolean;
  onUpdated: () => void | Promise<void>;
};

export function ManageEmployeeProjectsDialog({
  employee,
  projects,
  canManage,
  canManageProject,
  onUpdated,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentProjects = React.useMemo(
    () => getProjectsForEmployee(employee.id, projects),
    [employee.id, projects],
  );

  const assignable = React.useMemo(
    () => assignableProjectsForEmployee(employee, projects, canManageProject),
    [employee, projects, canManageProject],
  );

  React.useEffect(() => {
    if (!open) return;
    setSelectedIds(currentProjects.map((p) => p.id));
    setError(null);
  }, [open, currentProjects]);

  const toggle = (projectId: string) => {
    setSelectedIds((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId],
    );
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employee.id}/projects`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: selectedIds }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await onUpdated();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Projects
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Projects for {employee.name}</DialogTitle>
          <DialogDescription>
            Select every project this employee is working on. They can be on multiple
            projects at once.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {assignable.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects available for you to assign in this employee&apos;s scope.
          </p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {assignable.map((p) => {
              const on = selectedIds.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                      on
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/70 hover:bg-muted/50"
                    }`}
                  >
                    <span>
                      <span className="font-medium">{p.name}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {p.team}
                      </span>
                    </span>
                    <Badge variant={projectStatusVariant(p.status)} className="shrink-0">
                      {p.status}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || assignable.length === 0}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save projects"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

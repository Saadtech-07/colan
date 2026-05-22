"use client";

import * as React from "react";
import {
  Briefcase,
  Calendar,
  Check,
  Loader2,
  Search,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseApiError } from "@/providers/app-state";
import {
  assignableProjectsForEmployee,
  projectStatusVariant,
} from "@/lib/project-assignments";
import { filterProjectsByEmployeeTeam } from "@/lib/projects";
import type { Employee, Project } from "@/types";

type AssignmentPayload = {
  employee: Employee;
  assigned: Project[];
  assignable: Project[];
};

type Props = {
  employee: Employee;
  projects: Project[];
  canManageProject: (project: Project) => boolean;
  onUpdated: () => void | Promise<void>;
};

function formatProjectDate(value: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectAssignmentModal({
  employee,
  projects,
  canManageProject,
  onUpdated,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [payload, setPayload] = React.useState<AssignmentPayload | null>(null);

  const fallbackAssignable = React.useMemo(
    () => assignableProjectsForEmployee(employee, projects, canManageProject),
    [employee, projects, canManageProject],
  );

  const teamProjects = React.useMemo(
    () => filterProjectsByEmployeeTeam(employee, projects),
    [employee, projects],
  );

  const assignable = payload?.assignable ?? fallbackAssignable;
  const assigned = payload?.assigned ?? [];

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSearch("");

    (async () => {
      try {
        const res = await fetch(`/api/employees/${employee.id}/projects`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        const data = (await res.json()) as AssignmentPayload;
        if (cancelled) return;
        setPayload(data);
        setSelectedIds(data.assigned.map((p) => p.id));
      } catch (e) {
        if (cancelled) return;
        setPayload(null);
        const current = teamProjects.filter((p) =>
          p.memberIds.includes(employee.id),
        );
        setSelectedIds(current.map((p) => p.id));
        setError(
          e instanceof Error ? e.message : "Could not load project assignments",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, employee.id]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q) ||
        p.teams.some((t) => t.toLowerCase().includes(q)),
    );
  }, [assignable, search]);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Briefcase className="h-3.5 w-3.5" />
          Projects
          {assigned.length > 0 && (
            <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-semibold tabular-nums text-primary">
              {assigned.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-3 border-b border-border/60 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-lg">Assign projects</DialogTitle>
              <DialogDescription>
                {employee.name} · only projects from{" "}
                <span className="font-medium text-foreground">{employee.team}</span>
              </DialogDescription>
            </div>
            <Badge variant="secondary" className="shrink-0 font-normal">
              {employee.team}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-md bg-muted/80 px-2 py-1 tabular-nums">
              {selectedIds.length} selected
            </span>
            <span className="rounded-md bg-muted/80 px-2 py-1 tabular-nums">
              {assignable.length} available in squad
            </span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              disabled={loading || assignable.length === 0}
            />
          </div>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Loading squad projects…</p>
            </div>
          ) : assignable.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
              <p className="font-medium">No projects in this squad</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a project for {employee.team} before assigning members.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No projects match &ldquo;{search}&rdquo;.
            </p>
          ) : (
            <ul className="space-y-2.5 pb-2">
              {filtered.map((p) => {
                const on = selectedIds.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={`group flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                        on
                          ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                          : "border-border/70 hover:border-primary/25 hover:bg-muted/40 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="font-semibold leading-tight">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.teams.join(" · ")}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <Badge variant={projectStatusVariant(p.status)}>
                            {p.status}
                          </Badge>
                          {on && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                              <Check className="h-3 w-3" />
                              Selected
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Start {formatProjectDate(p.assignedDate)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          End {formatProjectDate(p.lastDate)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || loading || assignable.length === 0}
          >
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

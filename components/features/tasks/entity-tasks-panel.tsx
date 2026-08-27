"use client";

import * as React from "react";
import Link from "next/link";
import { CheckSquare, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { projectFormLabelClassName } from "@/components/features/project-form-shared";
import { taskPriorityTone, taskStatusTone } from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import { parseApiError } from "@/providers/app-state";
import type { Task } from "@/types";

type Props = {
  projectId?: string;
  assigneeId?: string;
  title?: string;
  description?: string;
  emptyMessage?: string;
  onTasksChange?: (tasks: Task[]) => void;
  /** Matches project detail editor sections (assign team members). */
  variant?: "default" | "embedded";
};

function formatDueDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function EntityTasksPanel({
  projectId,
  assigneeId,
  title = "Tasks",
  description = "Tasks linked to this workspace",
  emptyMessage = "No tasks yet.",
  onTasksChange,
  variant = "default",
}: Props) {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const onTasksChangeRef = React.useRef(onTasksChange);

  React.useEffect(() => {
    onTasksChangeRef.current = onTasksChange;
  }, [onTasksChange]);

  const loadTasks = React.useCallback(async () => {
    if (!projectId && !assigneeId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (assigneeId) params.set("assigneeId", assigneeId);
      const res = await fetch(`/api/tasks?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as Task[];
      setTasks(data);
      onTasksChangeRef.current?.(data);
    } catch (e) {
      setTasks([]);
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [assigneeId, projectId]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const completedCount = tasks.filter((task) => task.status === "Done").length;
  const listBody = (
    <TaskListBody
      loading={loading}
      error={error}
      tasks={tasks}
      projectId={projectId}
      emptyMessage={emptyMessage}
      embedded={variant === "embedded"}
    />
  );

  if (variant === "embedded") {
    return (
      <div className="w-full min-w-0 space-y-5">
        <Label className={projectFormLabelClassName}>{title}</Label>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex flex-wrap items-center gap-2">
              {!loading && tasks.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {tasks.length} completed
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg border-border/55 bg-muted/20 shadow-none"
                asChild
              >
                <Link href="/projects/tasks">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open tasks
                </Link>
              </Button>
            </div>
          </div>

          <p className={cn(projectFormLabelClassName, "normal-case tracking-normal")}>
            Project tasks ({loading && tasks.length === 0 ? "…" : tasks.length})
          </p>
        </div>

        <div>{listBody}</div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 bg-background px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!loading && tasks.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {completedCount} of {tasks.length} completed
            </span>
          ) : null}
          <Button variant="outline" size="sm" className="h-8 rounded-lg" asChild>
            <Link href="/projects/tasks">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open tasks
            </Link>
          </Button>
        </div>
      </header>

      <div className="bg-background">{listBody}</div>
    </section>
  );
}

function TaskListBody({
  loading,
  error,
  tasks,
  projectId,
  emptyMessage,
  embedded,
}: {
  loading: boolean;
  error: string | null;
  tasks: Task[];
  projectId?: string;
  emptyMessage: string;
  embedded: boolean;
}) {
  if (loading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center gap-2 text-sm text-muted-foreground",
          embedded
            ? "rounded-lg border border-border/55 bg-muted/10 px-4 py-10"
            : "px-6 py-10",
        )}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading tasks...
      </div>
    );
  }

  if (error) {
    return (
      <p
        className={cn(
          "text-sm text-destructive",
          embedded ? "rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-8" : "px-6 py-8",
        )}
      >
        {error}
      </p>
    );
  }

  if (tasks.length === 0) {
    return (
      <div
        className={cn(
          embedded
            ? "rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-8 text-center"
            : "px-6 py-10 text-center",
        )}
      >
        <CheckSquare
          className={cn(
            "mx-auto text-muted-foreground/50",
            embedded ? "h-6 w-6" : "h-8 w-8",
          )}
        />
        <p className="mt-3 text-sm font-medium text-foreground">{emptyMessage}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a task from the Tasks workspace to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn(embedded && "overflow-hidden rounded-lg border border-border/55")}>
      <ul
        className={cn(
          "divide-y divide-border/50",
          embedded && "max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain",
        )}
      >
        {tasks.map((task) => (
          <li key={task.id}>
            <Link
              href="/projects/tasks"
              className={cn(
                "group flex flex-wrap items-center justify-between gap-3 transition-colors hover:bg-muted/25",
                embedded ? "bg-background px-4 py-3" : "bg-background px-6 py-4 hover:bg-muted/40",
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                  {task.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {projectId ? task.assigneeName ?? "Unassigned" : task.projectName ?? "Project"}
                  {task.dueDate ? ` · Due ${formatDueDate(task.dueDate)}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                    taskStatusTone(task.status),
                  )}
                >
                  {task.status}
                </Badge>
                <Badge
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                    taskPriorityTone(task.priority),
                  )}
                >
                  {task.priority}
                </Badge>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

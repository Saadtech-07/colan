"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  Filter,
  KanbanSquare,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageTitle, SectionTitle, sectionDescriptionClassName } from "@/components/ui/page-typography";
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  kanbanColumnTone,
  projectMemberEmployees,
  taskPriorityTone,
  taskStatusTone,
} from "@/lib/task-ui";
import { cn } from "@/lib/utils";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { Task, TaskDetail, TaskPriority, TaskStatus } from "@/types";

type ViewMode = "table" | "kanban";

type TaskFormState = {
  title: string;
  description: string;
  projectId: string;
  assigneeId: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  comment: string;
};

const emptyForm = (projectId = ""): TaskFormState => ({
  title: "",
  description: "",
  projectId,
  assigneeId: "",
  status: "Todo",
  priority: "Medium",
  dueDate: "",
  comment: "",
});

const taskFieldClassName =
  "h-10 rounded-xl border-border/70 bg-muted/15 shadow-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20";

const taskTextareaClassName =
  "min-h-[96px] rounded-xl border-border/70 bg-muted/15 shadow-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/20";

const filterMenuTriggerClass =
  "cursor-pointer rounded-xl hover:bg-accent focus:bg-accent data-[state=open]:bg-accent";
const filterMenuItemClass =
  "cursor-pointer rounded-xl hover:bg-accent focus:bg-accent";

export function TasksModule() {
  const { projects, employees, access, refreshData } = useAppState();
  const searchParams = useSearchParams();
  const createFromQueryHandledRef = React.useRef(false);
  const taskFromQueryHandledRef = React.useRef(false);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<ViewMode>("table");
  const [search, setSearch] = React.useState("");
  const [filterProject, setFilterProject] = React.useState("all");
  const [filterStatus, setFilterStatus] = React.useState("all");
  const [filterPriority, setFilterPriority] = React.useState("all");
  const [filterAssignee, setFilterAssignee] = React.useState("all");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<TaskDetail | null>(null);
  const [form, setForm] = React.useState<TaskFormState>(emptyForm());
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [taskPendingDelete, setTaskPendingDelete] = React.useState<Task | null>(null);

  const canCreate =
    access?.canManageProjects ||
    access?.has("projects:manage") ||
    access?.has("projects:manage_team") ||
    access?.role === "admin" ||
    access?.role === "manager";

  React.useEffect(() => {
    if (!canCreate || createFromQueryHandledRef.current) return;

    const assigneeId = searchParams.get("assignee")?.trim() ?? "";
    const shouldCreate = searchParams.get("create") === "1";
    if (!shouldCreate || !assigneeId) return;

    const assignee = employees.find((employee) => employee.id === assigneeId);
    if (!assignee) return;

    const assignedProject =
      projects.find((project) => project.memberIds?.includes(assigneeId)) ?? projects[0];

    setEditingId(null);
    setForm({
      ...emptyForm(assignedProject?.id ?? ""),
      assigneeId,
    });
    setFormOpen(true);
    createFromQueryHandledRef.current = true;
  }, [canCreate, employees, projects, searchParams]);

  const loadTasks = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterProject !== "all") params.set("projectId", filterProject);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterPriority !== "all") params.set("priority", filterPriority);
      if (filterAssignee !== "all") params.set("assigneeId", filterAssignee);
      const res = await fetch(`/api/tasks?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const data = (await res.json()) as Task[];
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filterAssignee, filterPriority, filterProject, filterStatus]);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const filterAssigneeOptions = React.useMemo(() => {
    const pool =
      filterProject === "all"
        ? employees
        : projectMemberEmployees(filterProject, projects, employees);
    return pool;
  }, [employees, filterProject, projects]);

  const formAssigneeOptions = React.useMemo(() => {
    const members = projectMemberEmployees(form.projectId, projects, employees);
    if (!form.assigneeId || members.some((employee) => employee.id === form.assigneeId)) {
      return members;
    }
    const currentAssignee = employees.find((employee) => employee.id === form.assigneeId);
    return currentAssignee ? [...members, currentAssignee] : members;
  }, [employees, form.assigneeId, form.projectId, projects]);

  React.useEffect(() => {
    if (filterAssignee === "all") return;
    if (!filterAssigneeOptions.some((employee) => employee.id === filterAssignee)) {
      setFilterAssignee("all");
    }
  }, [filterAssignee, filterAssigneeOptions]);

  const activeFilterCount = [
    filterProject !== "all",
    filterStatus !== "all",
    filterPriority !== "all",
    filterAssignee !== "all",
    search.trim().length > 0,
  ].filter(Boolean).length;

  const activeTaskFilterCount = [
    filterProject !== "all",
    filterStatus !== "all",
    filterPriority !== "all",
    filterAssignee !== "all",
  ].filter(Boolean).length;

  const filterProjectLabel =
    filterProject === "all"
      ? "All projects"
      : (projects.find((project) => project.id === filterProject)?.name ?? "Project");
  const filterAssigneeLabel =
    filterAssignee === "all"
      ? "All assignees"
      : (filterAssigneeOptions.find((employee) => employee.id === filterAssignee)?.name ??
        "Assignee");

  const resetFilters = () => {
    setSearch("");
    setFilterProject("all");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterAssignee("all");
  };

  const filteredTasks = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) =>
      [task.title, task.description, task.projectName, task.assigneeName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [search, tasks]);

  const openCreate = () => {
    setEditingId(null);
    const defaultProjectId =
      filterProject !== "all" ? filterProject : (projects[0]?.id ?? "");
    setForm(emptyForm(defaultProjectId));
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({
      title: task.title,
      description: task.description ?? "",
      projectId: task.projectId,
      assigneeId: task.assigneeId ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      comment: "",
    });
    setFormOpen(true);
  };

  const openDetails = async (taskId: string) => {
    setDrawerOpen(true);
    setSelectedTask(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseApiError(res));
      setSelectedTask((await res.json()) as TaskDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load task");
    }
  };

  React.useEffect(() => {
    const taskId = searchParams.get("task")?.trim() ?? "";
    if (!taskId || taskFromQueryHandledRef.current) return;

    taskFromQueryHandledRef.current = true;
    void openDetails(taskId);
  }, [searchParams]);

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        projectId: form.projectId,
        assigneeId: form.assigneeId || undefined,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        comment: form.comment || undefined,
      };
      const res = await fetch(editingId ? `/api/tasks/${editingId}` : "/api/tasks", {
        method: editingId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setFormOpen(false);
      await loadTasks();
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (taskId: string, status: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await loadTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask((await res.json()) as TaskDetail);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const deleteTaskById = async (taskId: string) => {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setDeleteDialogOpen(false);
      setTaskPendingDelete(null);
      setDrawerOpen(false);
      setFormOpen(false);
      setEditingId(null);
      setSelectedTask(null);
      await loadTasks();
      await refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete task");
    } finally {
      setDeleting(false);
    }
  };

  const requestDelete = (task: Task) => {
    setTaskPendingDelete(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!taskPendingDelete) return;
    void deleteTaskById(taskPendingDelete.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageTitle>Tasks</PageTitle>
          <p className={cn("mt-1", sectionDescriptionClassName)}>
            Enterprise task management with table and kanban views.
          </p>
        </div>
      </div>

      <Card className="border-border/70 bg-background/75 shadow-sm backdrop-blur-xl">
        <CardHeader className="space-y-4 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks by title, project, or assignee..."
                className="h-9 rounded-xl border border-border/70 bg-background pl-9 text-sm shadow-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="relative h-9 w-9 shrink-0 rounded-xl border-border/70 bg-background"
                    aria-label={
                      activeTaskFilterCount > 0
                        ? `Filters, ${activeTaskFilterCount} active`
                        : "Filters"
                    }
                  >
                    <Filter className="h-4 w-4" />
                    {activeTaskFilterCount > 0 ? (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                        {activeTaskFilterCount}
                      </span>
                    ) : null}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="max-h-none w-64 overflow-visible rounded-2xl border-border/60 bg-background/95 p-1.5 shadow-xl backdrop-blur"
                >
                  <DropdownMenuLabel className="px-2 text-xs text-muted-foreground">
                    Filter tasks
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/60" />

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                      Project · {filterProjectLabel}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto rounded-2xl border-border/60 p-1.5">
                      <DropdownMenuRadioGroup
                        value={filterProject}
                        onValueChange={setFilterProject}
                      >
                        <DropdownMenuRadioItem value="all" className={filterMenuItemClass}>
                          All projects
                        </DropdownMenuRadioItem>
                        {projects.map((project) => (
                          <DropdownMenuRadioItem
                            key={project.id}
                            value={project.id}
                            className={filterMenuItemClass}
                          >
                            {project.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                      Status · {filterStatus === "all" ? "All statuses" : filterStatus}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                      <DropdownMenuRadioGroup
                        value={filterStatus}
                        onValueChange={setFilterStatus}
                      >
                        <DropdownMenuRadioItem value="all" className={filterMenuItemClass}>
                          All statuses
                        </DropdownMenuRadioItem>
                        {TASK_STATUS_OPTIONS.map((status) => (
                          <DropdownMenuRadioItem
                            key={status}
                            value={status}
                            className={filterMenuItemClass}
                          >
                            {status}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className={filterMenuTriggerClass}>
                      Priority · {filterPriority === "all" ? "All priorities" : filterPriority}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="rounded-2xl border-border/60 p-1.5">
                      <DropdownMenuRadioGroup
                        value={filterPriority}
                        onValueChange={setFilterPriority}
                      >
                        <DropdownMenuRadioItem value="all" className={filterMenuItemClass}>
                          All priorities
                        </DropdownMenuRadioItem>
                        {TASK_PRIORITY_OPTIONS.map((priority) => (
                          <DropdownMenuRadioItem
                            key={priority}
                            value={priority}
                            className={filterMenuItemClass}
                          >
                            {priority}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger
                      className={filterMenuTriggerClass}
                      disabled={filterProject !== "all" && filterAssigneeOptions.length === 0}
                    >
                      Assignee · {filterAssigneeLabel}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-64 overflow-y-auto rounded-2xl border-border/60 p-1.5">
                      <DropdownMenuRadioGroup
                        value={filterAssignee}
                        onValueChange={setFilterAssignee}
                      >
                        <DropdownMenuRadioItem value="all" className={filterMenuItemClass}>
                          All assignees
                        </DropdownMenuRadioItem>
                        {filterAssigneeOptions.map((employee) => (
                          <DropdownMenuRadioItem
                            key={employee.id}
                            value={employee.id}
                            className={filterMenuItemClass}
                          >
                            {employee.name}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator className="bg-border/60" />
                  <DropdownMenuItem
                    className={filterMenuItemClass}
                    disabled={activeTaskFilterCount === 0}
                    onSelect={resetFilters}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset filters
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tabs value={view} onValueChange={(value) => setView(value as ViewMode)}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="table" className="gap-1.5 rounded-lg">
                    <LayoutList className="h-4 w-4" />
                    Table
                  </TabsTrigger>
                  <TabsTrigger value="kanban" className="gap-1.5 rounded-lg">
                    <KanbanSquare className="h-4 w-4" />
                    Kanban
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              {canCreate ? (
                <Button onClick={openCreate} className="h-9 shrink-0 rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Create task
                </Button>
              ) : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {activeFilterCount > 0
              ? `${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} applied`
              : "Showing all tasks"}
          </p>
        </CardHeader>

        <CardContent className="pt-6">
          {error ? (
            <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading tasks...
            </div>
          ) : view === "table" ? (
            <TaskTable
              tasks={filteredTasks}
              onOpen={openDetails}
              onEdit={openEdit}
              onDelete={requestDelete}
              onStatusChange={updateStatus}
              canManage={!!canCreate}
            />
          ) : (
            <TaskKanban tasks={filteredTasks} onOpen={openDetails} onStatusChange={updateStatus} />
          )}
        </CardContent>
      </Card>

      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <div className="relative border-b border-border/60 bg-gradient-to-br from-primary/10 via-background to-violet-500/5 px-6 pb-5 pt-8">
            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-sm">
                {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </div>
              <SheetHeader className="space-y-1 border-0 p-0 text-left">
                <SheetTitle className="text-xl">
                  {editingId ? "Edit task" : "Create task"}
                </SheetTitle>
                <SheetDescription>
                  {editingId
                    ? "Update details, assignment, and workflow status."
                    : "Choose a project first — assignees are limited to that project's members."}
                </SheetDescription>
              </SheetHeader>
            </div>
          </div>

          <form onSubmit={submitForm} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <FormSection title="Basics">
                <Field label="Title">
                  <Input
                    required
                    value={form.title}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    className={taskFieldClassName}
                    placeholder="What needs to be done?"
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className={taskTextareaClassName}
                    placeholder="Add context, acceptance criteria, or links"
                  />
                </Field>
              </FormSection>

              <FormSection title="Assignment">
                <Field label="Project">
                  <Select
                    value={form.projectId}
                    onValueChange={(value) =>
                      setForm((prev) => {
                        const nextAssignees = projectMemberEmployees(value, projects, employees);
                        const assigneeStillValid =
                          !prev.assigneeId ||
                          nextAssignees.some((employee) => employee.id === prev.assigneeId);
                        return {
                          ...prev,
                          projectId: value,
                          assigneeId: assigneeStillValid ? prev.assigneeId : "",
                        };
                      })
                    }
                  >
                    <SelectTrigger className={taskFieldClassName}>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Assignee"
                  hint={
                    form.projectId && formAssigneeOptions.length === 0
                      ? "Add members to this project before assigning tasks."
                      : form.projectId
                        ? "Only members assigned to the selected project are shown."
                        : undefined
                  }
                >
                  <Select
                    value={form.assigneeId || "none"}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, assigneeId: value === "none" ? "" : value }))
                    }
                    disabled={!form.projectId || formAssigneeOptions.length === 0}
                  >
                    <SelectTrigger className={taskFieldClassName}>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {formAssigneeOptions.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FormSection>

              <FormSection title="Workflow">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Status">
                    <Select
                      value={form.status}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, status: value as TaskStatus }))
                      }
                    >
                      <SelectTrigger className={taskFieldClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_STATUS_OPTIONS.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Priority">
                    <Select
                      value={form.priority}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, priority: value as TaskPriority }))
                      }
                    >
                      <SelectTrigger className={taskFieldClassName}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TASK_PRIORITY_OPTIONS.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Due date">
                  <Input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                    className={taskFieldClassName}
                  />
                </Field>
              </FormSection>

              <FormSection title="Activity note">
                <Field label="Comment">
                  <Textarea
                    rows={3}
                    value={form.comment}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, comment: event.target.value }))
                    }
                    placeholder="Optional note for activity history"
                    className={taskTextareaClassName}
                  />
                </Field>
              </FormSection>
            </div>

            <SheetFooter className="flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
              {editingId && canCreate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={saving || deleting}
                  onClick={() => {
                    const task = tasks.find((row) => row.id === editingId);
                    if (task) requestDelete(task);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                disabled={saving || deleting}
                className="h-10 min-w-[140px] rounded-xl shadow-sm"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingId ? "Save changes" : "Create task"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              {taskPendingDelete
                ? `"${taskPendingDelete.title}" will be permanently removed. This cannot be undone.`
                : "This task will be permanently removed."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={deleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          {selectedTask ? (
            <>
              <div className="border-b border-border/60 bg-gradient-to-br from-primary/8 via-background to-cyan-500/5 px-6 pb-5 pt-8">
                <SheetHeader className="space-y-2 border-0 p-0 pr-8 text-left">
                  <SheetTitle className="text-xl leading-snug">{selectedTask.title}</SheetTitle>
                  <SheetDescription className="text-sm">
                    {selectedTask.projectName}
                  </SheetDescription>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Badge className={taskStatusTone(selectedTask.status)}>{selectedTask.status}</Badge>
                    <Badge className={taskPriorityTone(selectedTask.priority)}>
                      {selectedTask.priority}
                    </Badge>
                  </div>
                </SheetHeader>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
                {selectedTask.description ? (
                  <p className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                    {selectedTask.description}
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetaRow label="Assignee" value={selectedTask.assigneeName ?? "Unassigned"} />
                  <MetaRow
                    label="Due date"
                    value={selectedTask.dueDate ? formatDate(selectedTask.dueDate) : "—"}
                  />
                  <MetaRow label="Created by" value={selectedTask.createdByName ?? "—"} />
                  <MetaRow label="Updated" value={formatDateTime(selectedTask.updatedAt)} />
                </div>

                <div>
                  <SectionTitle as="h3" className="text-base">
                    Comments
                  </SectionTitle>
                  <div className="mt-3 space-y-3">
                    {selectedTask.comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments yet.</p>
                    ) : (
                      selectedTask.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-xl border border-border/60 bg-muted/15 p-3"
                        >
                          <p className="text-sm">{comment.body}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {comment.authorName} · {formatDateTime(comment.createdAt)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <SectionTitle as="h3" className="text-base">
                    Activity
                  </SectionTitle>
                  <div className="mt-3 space-y-2">
                    {selectedTask.activity.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex gap-3 rounded-xl border border-border/50 bg-background px-3 py-2.5 text-sm"
                      >
                        <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                        <div>
                          <p className="font-medium">{entry.action}</p>
                          <p className="text-muted-foreground">
                            {entry.details || entry.actorName} · {formatDateTime(entry.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {canCreate ? (
                <SheetFooter className="flex-row justify-between gap-3 border-t border-border/60 bg-muted/10 px-6 py-4">
                  <Button
                    variant="outline"
                    className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => requestDelete(selectedTask)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                  <Button
                    className="rounded-xl"
                    onClick={() => {
                      setDrawerOpen(false);
                      openEdit(selectedTask);
                    }}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit task
                  </Button>
                </SheetFooter>
              ) : null}
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TaskTable({
  tasks,
  onOpen,
  onEdit,
  onDelete,
  onStatusChange,
  canManage,
}: {
  tasks: Task[];
  onOpen: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  canManage: boolean;
}) {
  if (tasks.length === 0) {
    return <EmptyState message="No tasks match your filters." />;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/50">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/25 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-5 py-3.5 font-semibold">Task</th>
              <th className="px-5 py-3.5 font-semibold">Project</th>
              <th className="px-5 py-3.5 font-semibold">Assignee</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
              <th className="px-5 py-3.5 font-semibold">Priority</th>
              <th className="px-5 py-3.5 font-semibold">Due</th>
              {canManage ? <th className="px-5 py-3.5 text-right font-semibold">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="group transition-colors hover:bg-muted/20"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onOpen(task.id)}
                    className="text-left font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {task.title}
                  </button>
                  {task.description ? (
                    <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                      {task.description}
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground">
                    {task.projectName}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <UserRound className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm">{task.assigneeName ?? "Unassigned"}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <Select
                    value={task.status}
                    onValueChange={(value) => onStatusChange(task.id, value as TaskStatus)}
                  >
                    <SelectTrigger
                      className={cn(
                        "h-8 w-[148px] rounded-full border-0 text-xs font-medium shadow-none",
                        taskStatusTone(task.status),
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-5 py-4">
                  <Badge className={cn("rounded-full px-2.5 py-0.5", taskPriorityTone(task.priority))}>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {task.dueDate ? formatDate(task.dueDate) : "—"}
                  </span>
                </td>
                {canManage ? (
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary"
                        onClick={() => onEdit(task)}
                        aria-label={`Edit ${task.title}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(task)}
                        aria-label={`Delete ${task.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskKanban({
  tasks,
  onOpen,
  onStatusChange,
}: {
  tasks: Task[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {TASK_STATUS_OPTIONS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <div
            key={status}
            className={cn("rounded-xl border p-3", kanbanColumnTone(status))}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const taskId = event.dataTransfer.getData("text/task-id");
              if (taskId) void onStatusChange(taskId, status);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{status}</h3>
              <Badge variant="secondary">{columnTasks.length}</Badge>
            </div>
            <div className="space-y-3">
              {columnTasks.map((task) => (
                <Card
                  key={task.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("text/task-id", task.id)}
                  className="cursor-grab border-border/60 shadow-sm active:cursor-grabbing"
                >
                  <CardHeader className="space-y-2 p-4 pb-2">
                    <button
                      type="button"
                      onClick={() => onOpen(task.id)}
                      className="text-left text-sm font-semibold hover:text-primary"
                    >
                      {task.title}
                    </button>
                    <p className="text-xs text-muted-foreground">{task.projectName}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    <div className="flex flex-wrap gap-2">
                      <Badge className={taskPriorityTone(task.priority)}>{task.priority}</Badge>
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {task.assigneeName ?? "Unassigned"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/15 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 px-6 py-12 text-center">
      <CheckSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
      <p className="font-medium text-foreground">{message}</p>
    </div>
  );
}

function formatDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

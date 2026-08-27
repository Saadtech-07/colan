import type { Employee, Project, TaskPriority, TaskStatus } from "@/types";

export function projectMemberEmployees(
  projectId: string,
  projects: Project[],
  employees: Employee[],
): Employee[] {
  if (!projectId) return employees;
  const project = projects.find((entry) => entry.id === projectId);
  if (!project) return [];
  const memberIds = new Set(project.memberIds ?? []);
  if (memberIds.size === 0) return [];
  return employees.filter((employee) => memberIds.has(employee.id));
}

export const TASK_STATUS_OPTIONS: TaskStatus[] = ["Todo", "In Progress", "Review", "Done"];
export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ["Low", "Medium", "High", "Critical"];

export function taskStatusTone(status: TaskStatus): string {
  switch (status) {
    case "Todo":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    case "In Progress":
      return "bg-primary/15 text-primary";
    case "Review":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "Done":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function taskPriorityTone(priority: TaskPriority): string {
  switch (priority) {
    case "Low":
      return "bg-slate-500/10 text-slate-600 dark:text-slate-300";
    case "Medium":
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "High":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "Critical":
      return "bg-destructive/15 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function kanbanColumnTone(status: TaskStatus): string {
  switch (status) {
    case "Todo":
      return "border-slate-500/20 bg-slate-500/5";
    case "In Progress":
      return "border-primary/20 bg-primary/5";
    case "Review":
      return "border-amber-500/20 bg-amber-500/5";
    case "Done":
      return "border-emerald-500/20 bg-emerald-500/5";
    default:
      return "border-border bg-muted/20";
  }
}

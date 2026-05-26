import type { Project, ProjectStatus } from "@/types";

export const PROJECT_STATUSES: ProjectStatus[] = [
  "Yet To Start",
  "In Progress",
  "Completed",
];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseProjectDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatProjectDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  },
) {
  const parsed = parseProjectDate(value);
  if (!parsed) return value || "No date";
  return parsed.toLocaleDateString(undefined, options);
}

export function isProjectDelayed(project: Pick<Project, "lastDate" | "status">, today = new Date()) {
  if (project.status === "Completed") return false;
  const deadline = parseProjectDate(project.lastDate);
  if (!deadline) return false;
  return deadline < startOfDay(today);
}

export function isProjectDueSoon(
  project: Pick<Project, "lastDate" | "status">,
  today = new Date(),
  withinDays = 7,
) {
  if (project.status === "Completed") return false;
  const deadline = parseProjectDate(project.lastDate);
  if (!deadline) return false;
  const start = startOfDay(today);
  const end = startOfDay(today);
  end.setDate(end.getDate() + withinDays);
  return deadline >= start && deadline <= end;
}

export function projectProgressPercent(
  project: Pick<Project, "assignedDate" | "lastDate" | "status">,
  today = new Date(),
) {
  if (project.status === "Completed") return 100;
  if (project.status === "Yet To Start") return 12;

  const start = parseProjectDate(project.assignedDate);
  const end = parseProjectDate(project.lastDate);
  if (!start || !end || end <= start) return 68;

  const total = end.getTime() - start.getTime();
  const elapsed = startOfDay(today).getTime() - start.getTime();
  const raw = Math.round((elapsed / total) * 100);

  if (isProjectDelayed(project, today)) {
    return Math.max(85, Math.min(97, raw));
  }
  return Math.max(18, Math.min(92, raw));
}

export function projectPriority(project: Pick<Project, "lastDate" | "status">, today = new Date()) {
  if (isProjectDelayed(project, today)) {
    return {
      label: "High priority",
      toneClass: "border-transparent bg-destructive/10 text-destructive",
    };
  }
  if (isProjectDueSoon(project, today, 7)) {
    return {
      label: "Medium priority",
      toneClass:
        "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: "Planned",
    toneClass: "border-transparent bg-primary/10 text-primary",
  };
}

export function relativeProjectDeadline(value: string, today = new Date()) {
  const deadline = parseProjectDate(value);
  if (!deadline) return value;
  const delta = Math.round(
    (deadline.getTime() - startOfDay(today).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (delta === 0) return "Due today";
  if (delta === 1) return "Due tomorrow";
  if (delta === -1) return "Due yesterday";
  if (delta > 1) return `Due in ${delta} days`;
  return `${Math.abs(delta)} days overdue`;
}


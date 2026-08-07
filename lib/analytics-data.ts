import { listProjects } from "@/lib/data-service";
import { listTasks } from "@/lib/tasks-data";
import { TASK_STATUSES } from "@/models";
import type { ProjectAnalytics, TaskAnalytics, WorkloadAnalytics } from "@/types";
import { filterProjectsForUser } from "@/lib/permissions";
import type { AppRole, TeamName } from "@/types";

export async function getProjectAnalytics(
  role: AppRole,
  team?: TeamName,
): Promise<ProjectAnalytics> {
  const projects = filterProjectsForUser(await listProjects(), role, team);
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "In Progress").length,
    completedProjects: projects.filter((project) => project.status === "Completed").length,
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      progressPercentage:
        project.progressPercentage ??
        (project.totalTasks && project.totalTasks > 0
          ? Math.round(((project.completedTasks ?? 0) / project.totalTasks) * 100)
          : 0),
      totalTasks: project.totalTasks ?? 0,
      completedTasks: project.completedTasks ?? 0,
      status: project.status,
    })),
  };
}

export async function getTaskAnalytics(
  role: AppRole,
  team?: TeamName,
  visibleProjectIds?: Set<string>,
): Promise<TaskAnalytics> {
  const projects = filterProjectsForUser(await listProjects(), role, team);
  const allowedIds = visibleProjectIds ?? new Set(projects.map((project) => project.id));
  const tasks = (await listTasks()).filter((task) => allowedIds.has(task.projectId));

  const completedTasks = tasks.filter((task) => task.status === "Done").length;
  const statusDistribution = TASK_STATUSES.map((status) => ({
    status,
    count: tasks.filter((task) => task.status === status).length,
  }));

  return {
    totalTasks: tasks.length,
    completedTasks,
    pendingTasks: tasks.length - completedTasks,
    statusDistribution,
  };
}

export async function getWorkloadAnalytics(
  role: AppRole,
  team?: TeamName,
  visibleProjectIds?: Set<string>,
): Promise<WorkloadAnalytics> {
  const projects = filterProjectsForUser(await listProjects(), role, team);
  const allowedIds = visibleProjectIds ?? new Set(projects.map((project) => project.id));
  const tasks = (await listTasks()).filter((task) => allowedIds.has(task.projectId));

  const byAssignee = new Map<
    string,
    { employeeName: string; total: number; completed: number; inProgress: number; pending: number }
  >();

  for (const task of tasks) {
    const key = task.assigneeId ?? "unassigned";
    const name = task.assigneeName ?? "Unassigned";
    const row = byAssignee.get(key) ?? {
      employeeName: name,
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
    };
    row.total += 1;
    if (task.status === "Done") row.completed += 1;
    else if (task.status === "In Progress") row.inProgress += 1;
    else row.pending += 1;
    byAssignee.set(key, row);
  }

  return {
    assignees: [...byAssignee.entries()]
      .filter(([employeeId]) => employeeId !== "unassigned")
      .map(([employeeId, row]) => ({
        employeeId,
        employeeName: row.employeeName,
        totalTasks: row.total,
        completedTasks: row.completed,
        inProgressTasks: row.inProgress,
        pendingTasks: row.pending,
      }))
      .sort((a, b) => b.totalTasks - a.totalTasks),
  };
}

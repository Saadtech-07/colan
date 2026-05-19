import type { Employee, Project, ProjectStatus } from "@/types";

/** Projects where the employee id appears in `memberIds`. */
export function getProjectsForEmployee(
  employeeId: string,
  projects: Project[],
): Project[] {
  return projects.filter((p) => p.memberIds.includes(employeeId));
}

export function projectStatusVariant(
  status: ProjectStatus,
): "default" | "secondary" | "outline" {
  if (status === "Completed") return "secondary";
  if (status === "In Progress") return "default";
  return "outline";
}

/** Projects the user may assign this employee to (by team / role). */
export function assignableProjectsForEmployee(
  employee: Employee,
  projects: Project[],
  canManageProject: (projectTeam: Project["team"]) => boolean,
): Project[] {
  return projects.filter((p) => canManageProject(p.team));
}

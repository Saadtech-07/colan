import { filterProjectsByEmployeeTeam } from "@/lib/projects";
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

/**
 * Projects an admin/lead may assign to this employee: same squad only, plus role scope.
 */
export function assignableProjectsForEmployee(
  employee: Employee,
  projects: Project[],
  canManageProject: (project: Project) => boolean,
): Project[] {
  return filterProjectsByEmployeeTeam(employee, projects).filter((p) =>
    canManageProject(p),
  );
}
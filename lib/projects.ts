import { projectBelongsToTeam } from "@/lib/project-teams";
import type { Employee, Project, TeamName } from "@/types";

/** Projects that belong to the employee's squad (supports multi-team projects). */
export function filterProjectsByEmployeeTeam(
  employee: Pick<Employee, "team">,
  projects: Project[],
): Project[] {
  return projects.filter((p) => projectBelongsToTeam(p, employee.team));
}

export function assertProjectsMatchEmployeeTeam(
  employeeTeam: TeamName,
  projectIds: string[],
  projects: Project[],
): void {
  for (const projectId of projectIds) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error("One or more projects were not found.");
    }
    if (!projectBelongsToTeam(project, employeeTeam)) {
      throw new Error(
        `Cannot assign "${project.name}" — it is not part of ${employeeTeam}. Cross-team assignment is not allowed.`,
      );
    }
  }
}

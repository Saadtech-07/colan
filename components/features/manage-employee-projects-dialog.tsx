"use client";

import { ProjectAssignmentModal } from "@/components/features/project-assignment-modal";
import type { Employee, Project } from "@/types";

type Props = {
  employee: Employee;
  projects: Project[];
  canManage: boolean;
  canManageProject: (project: Project) => boolean;
  onUpdated: () => void | Promise<void>;
};

/** @deprecated Use ProjectAssignmentModal directly. */
export function ManageEmployeeProjectsDialog({
  employee,
  projects,
  canManage,
  canManageProject,
  onUpdated,
}: Props) {
  if (!canManage) return null;

  return (
    <ProjectAssignmentModal
      employee={employee}
      projects={projects}
      canManageProject={canManageProject}
      onUpdated={onUpdated}
    />
  );
}

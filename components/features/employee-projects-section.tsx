"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  getProjectsForEmployee,
  projectStatusVariant,
} from "@/lib/project-assignments";
import { filterProjectsByEmployeeTeam } from "@/lib/projects";
import type { Employee, Project } from "@/types";

type Props = {
  employee: Employee;
  projects: Project[];
};

export function EmployeeProjectsSection({ employee, projects }: Props) {
  const assigned = filterProjectsByEmployeeTeam(
    employee,
    getProjectsForEmployee(employee.id, projects),
  );

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Projects
      </p>
      {assigned.length === 0 ? (
        <p className="mt-1.5 text-xs text-muted-foreground">Not assigned to any project yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {assigned.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.slug}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 truncate font-medium">{p.name}</span>
                <Badge
                  variant={projectStatusVariant(p.status)}
                  className="shrink-0 text-[10px]"
                >
                  {p.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

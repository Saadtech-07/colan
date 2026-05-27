"use client";

import Link from "next/link";
import {
  Briefcase,
  Calendar,
  FileText,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";
import { projectStatusVariant } from "@/lib/project-assignments";
import {
  formatProjectDate,
  projectPriority,
  projectProgressPercent,
  relativeProjectDeadline,
} from "@/lib/project-ui";
import { teamTabLabel } from "@/lib/team-utils";
import {
  employeeAssignedProjects,
} from "@/lib/team-members-ui";
import { cn } from "@/lib/utils";
import type { EmployeeDetail, Project } from "@/types";

type Props = {
  employee: EmployeeDetail;
  projects: Project[];
  canAssignProjects: boolean;
  canManageProject: (project: Project) => boolean;
  onRefresh: () => void | Promise<void>;
};

export function EmployeeDetailView({
  employee,
  projects,
  canAssignProjects,
  canManageProject,
  onRefresh,
}: Props) {
  const directory = employee.directory;
  const assignedProjects = employeeAssignedProjects(employee, projects);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Assigned projects</CardTitle>
              <CardDescription>
                {assignedProjects.length === 0
                  ? "No project assignments yet."
                  : `${assignedProjects.length} assigned project${assignedProjects.length === 1 ? "" : "s"}`}
              </CardDescription>
            </div>
            {canAssignProjects && (
              <ManageEmployeeProjectsDialog
                employee={employee}
                projects={projects}
                canManage={canAssignProjects}
                canManageProject={canManageProject}
                onUpdated={onRefresh}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {assignedProjects.length === 0 ? (
            <EmptyCardState
              icon={<Briefcase className="h-5 w-5 text-muted-foreground" />}
              title="No projects assigned"
              description="Assign work from the employee workspace to populate this section."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {assignedProjects.map((project) => {
                const progress = projectProgressPercent(project);
                const priority = projectPriority(project);

                return (
                  <Link
                    key={project.id}
                    href={`/projects/${project.slug}`}
                    className="group block rounded-2xl border border-border/60 bg-background/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                            {project.name}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {project.teams.map(teamTabLabel).join(" + ")}
                          </p>
                        </div>
                        <Badge
                          variant={projectStatusVariant(project.status)}
                          className="shrink-0"
                        >
                          {project.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <div
                          className={cn(
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            priority.toneClass,
                          )}
                        >
                          {priority.label}
                        </div>
                        <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/20 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                          Due {formatProjectDate(project.lastDate)}
                        </div>
                      </div>

                      <div className="grid gap-2 text-xs text-muted-foreground">
                        <span>{relativeProjectDeadline(project.lastDate)}</span>
                        <span>
                          {formatProjectDate(project.assignedDate)} to{" "}
                          {formatProjectDate(project.lastDate)}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted/70">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              project.status === "Completed"
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                : project.status === "In Progress"
                                  ? "bg-gradient-to-r from-primary via-indigo-500 to-cyan-400"
                                  : "bg-gradient-to-r from-slate-400 to-slate-300",
                            )}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Directory and profile</CardTitle>
          <CardDescription>Contact and employee details from the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {directory &&
          (directory.workEmail ||
            directory.phone ||
            directory.location ||
            directory.joinedDate) ? (
            <dl className="grid gap-5 text-sm sm:grid-cols-2">
              {directory.workEmail && (
                <DetailRow
                  icon={<Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  label="Work email"
                  value={
                    <a
                      href={`mailto:${directory.workEmail}`}
                      className="text-primary hover:underline"
                    >
                      {directory.workEmail}
                    </a>
                  }
                />
              )}
              {directory.phone && (
                <DetailRow
                  icon={<Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  label="Phone"
                  value={directory.phone}
                />
              )}
              {directory.location && (
                <DetailRow
                  icon={<MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  label="Location"
                  value={directory.location}
                />
              )}
              {directory.joinedDate && (
                <DetailRow
                  icon={<Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  label="Joined date"
                  value={directory.joinedDate}
                />
              )}
            </dl>
          ) : (
            <EmptyCardState
              icon={<FileText className="h-5 w-5 text-muted-foreground" />}
              title="No directory details on file"
              description="Update the employee profile to add work email, phone, location, and joined date."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      {icon}
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function EmptyCardState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">{icon}</div>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

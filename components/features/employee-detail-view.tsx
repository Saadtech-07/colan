"use client";

import Link from "next/link";
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock3,
  FileText,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  Sparkles,
  Users2,
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
import { isValidSeatId } from "@/lib/seating-layout";
import { teamTabLabel } from "@/lib/team-utils";
import {
  employeeActivityFeed,
  employeeAssignedProjects,
  employeeAvailabilityState,
  employeeCompletionRate,
  employeeCompletedProjects,
  employeeWorkloadPercent,
  employeeWorkspaceStatus,
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
  const seatValid = employee.bayNumber && isValidSeatId(employee.bayNumber);
  const assignedProjects = employeeAssignedProjects(employee, projects);
  const activeProjects = assignedProjects.filter((project) => project.status !== "Completed");
  const completedProjects = employeeCompletedProjects(employee, projects).length;
  const completionRate = employeeCompletionRate(employee, projects);
  const workload = employeeWorkloadPercent(employee, projects);
  const availability = employeeAvailabilityState(employee, projects);
  const workspace = employeeWorkspaceStatus(employee);
  const activity = employeeActivityFeed(employee, projects);
  const sprintContribution =
    assignedProjects.length === 0 ? 0 : Math.min(100, Math.round((completionRate + workload) / 2));
  const zone = employee.bayNumber ? `${employee.bayNumber.charAt(0)}-Zone` : "Unassigned";

  return (
    <div className="space-y-6">
      <section id="employee-performance" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <PerformanceCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
          title="Projects Completed"
          value={String(completedProjects)}
          hint="Closed project assignments"
        />
        <PerformanceCard
          icon={<Briefcase className="h-5 w-5 text-primary" />}
          title="Active Projects"
          value={String(activeProjects.length)}
          hint="Current delivery assignments"
        />
        <PerformanceCard
          icon={<BarChart3 className="h-5 w-5 text-cyan-500" />}
          title="Completion Rate"
          value={`${completionRate}%`}
          hint="Across assigned projects"
        />
        <PerformanceCard
          icon={<Activity className="h-5 w-5 text-violet-500" />}
          title="Workload"
          value={`${workload}%`}
          hint={availability.label}
        />
        <PerformanceCard
          icon={<Sparkles className="h-5 w-5 text-amber-500" />}
          title="Sprint Contribution"
          value={`${sprintContribution}%`}
          hint="Derived from workload and completion"
        />
        <PerformanceCard
          icon={<Users2 className="h-5 w-5 text-indigo-500" />}
          title="Assignments"
          value={String(assignedProjects.length)}
          hint="Visible project commitments"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Assigned projects</CardTitle>
                  <CardDescription>
                    {assignedProjects.length === 0
                      ? "No active assignments yet."
                      : `${assignedProjects.length} project workspace card${assignedProjects.length === 1 ? "" : "s"}`}
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
              <CardDescription>Contact and internal employee details from the workspace.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {directory &&
              (directory.workEmail ||
                directory.phone ||
                directory.location ||
                directory.joinedDate ||
                directory.notes) ? (
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
                      label="Joined"
                      value={directory.joinedDate}
                    />
                  )}
                  {directory.notes && (
                    <DetailRow
                      icon={<FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      label="Notes"
                      value={directory.notes}
                      className="sm:col-span-2"
                    />
                  )}
                </dl>
              ) : (
                <EmptyCardState
                  icon={<FileText className="h-5 w-5 text-muted-foreground" />}
                  title="No directory details on file"
                  description="Update the employee profile to add contact and workspace details."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-lg">Activity timeline</CardTitle>
              <CardDescription>Recent employee workspace and assignment activity.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {activity.length === 0 ? (
                <EmptyCardState
                  icon={<Clock3 className="h-5 w-5 text-muted-foreground" />}
                  title="No activity yet"
                  description="Activity will appear as projects, seating, and profile events accumulate."
                />
              ) : (
                <div className="space-y-4">
                  {activity.map((item, index) => (
                    <div key={item.id} className="relative flex gap-4">
                      {index < activity.length - 1 && (
                        <span className="absolute left-[1.05rem] top-9 h-[calc(100%-0.75rem)] w-px bg-border/70" />
                      )}
                      <div
                        className={cn(
                          "relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                          item.tone === "success"
                            ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300"
                            : item.tone === "warning"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "bg-primary/10 text-primary",
                        )}
                      >
                        {item.tone === "success" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : item.tone === "warning" ? (
                          <ShieldAlert className="h-4 w-4" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 rounded-2xl border border-border/60 bg-muted/15 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.date}</p>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-background/75 backdrop-blur-xl">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="text-lg">Workspace and seating</CardTitle>
              <CardDescription>Office seating, floor zone, and workspace visibility.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Workspace status
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{workspace.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{availability.label}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-2.5">
                    <LayoutGrid className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <MiniWorkspaceCard label="Team zone" value={zone} />
                <MiniWorkspaceCard
                  label="Floor plan"
                  value={seatValid ? "Mapped on office layout" : "Needs seat assignment"}
                />
              </div>

              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4">
                <p className="text-sm font-medium text-foreground">Floor plan preview</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {seatValid
                    ? `${employee.name} is currently placed at ${employee.bayNumber} in ${zone}.`
                    : employee.bayNumber
                      ? `Current seat value ${employee.bayNumber} is legacy and should be remapped from the seating page.`
                      : "No workspace seat has been assigned yet."}
                </p>
                <div className="mt-4">
                  <ButtonLink href="/seating" label="Open seating workspace" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-border/70 bg-background/75 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,0.45)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">{icon}</div>
        </div>
      </CardContent>
    </Card>
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

function MiniWorkspaceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
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

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-2xl border border-border/70 bg-background/80 px-3.5 py-2 text-sm font-medium shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent"
    >
      {label}
    </Link>
  );
}

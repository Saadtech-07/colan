"use client";

import Link from "next/link";
import {
  Briefcase,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Calendar,
  FileText,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";
import { projectStatusVariant } from "@/lib/project-assignments";
import { isValidSeatId } from "@/lib/seating-layout";
import { teamTabLabel } from "@/lib/team-utils";
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

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/70">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar className="h-24 w-24 ring-4 ring-muted">
              <AvatarImage src={employee.imageUrl} alt={employee.name} />
              <AvatarFallback className="text-2xl">
                {employee.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  {employee.name}
                </h1>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  {employee.employeeId}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-normal">
                  {employee.team}
                </Badge>
                <Badge variant="outline">{employee.role}</Badge>
                {seatValid ? (
                  <Badge variant="outline" className="gap-1 font-mono">
                    <LayoutGrid className="h-3 w-3" />
                    Seat {employee.bayNumber}
                  </Badge>
                ) : (
                  <Badge variant="outline">Unassigned seat</Badge>
                )}
              </div>
              {canAssignProjects && (
                <div className="flex flex-wrap gap-2">
                  <ManageEmployeeProjectsDialog
                    employee={employee}
                    projects={projects}
                    canManage={canAssignProjects}
                    canManageProject={canManageProject}
                    onUpdated={onRefresh}
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Directory</CardTitle>
            <CardDescription>Contact and workspace details from Atlas</CardDescription>
          </CardHeader>
          <CardContent>
            {directory &&
            (directory.workEmail ||
              directory.phone ||
              directory.location ||
              directory.joinedDate ||
              directory.notes) ? (
              <dl className="space-y-4 text-sm">
                {directory.workEmail && (
                  <div className="flex gap-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Work email
                      </dt>
                      <dd className="mt-0.5">
                        <a
                          href={`mailto:${directory.workEmail}`}
                          className="text-primary hover:underline"
                        >
                          {directory.workEmail}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
                {directory.phone && (
                  <div className="flex gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Phone
                      </dt>
                      <dd className="mt-0.5">{directory.phone}</dd>
                    </div>
                  </div>
                )}
                {directory.location && (
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Location
                      </dt>
                      <dd className="mt-0.5">{directory.location}</dd>
                    </div>
                  </div>
                )}
                {directory.joinedDate && (
                  <div className="flex gap-3">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Joined
                      </dt>
                      <dd className="mt-0.5">{directory.joinedDate}</dd>
                    </div>
                  </div>
                )}
                {directory.notes && (
                  <div className="flex gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Notes
                      </dt>
                      <dd className="mt-0.5 text-muted-foreground">{directory.notes}</dd>
                    </div>
                  </div>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No directory details on file.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5" />
              Assigned projects
            </CardTitle>
            <CardDescription>
              {employee.assignedProjects.length === 0
                ? "Not on any squad project yet."
                : `${employee.assignedProjects.length} project(s) for ${teamTabLabel(employee.team)}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {employee.assignedProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Use the Projects button above to assign work.
              </p>
            ) : (
              <ul className="space-y-2">
                {employee.assignedProjects.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.slug}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 transition-colors hover:bg-muted/60"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.assignedDate} → {p.lastDate}
                        </p>
                      </div>
                      <Badge variant={projectStatusVariant(p.status)}>{p.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seating</CardTitle>
          <CardDescription>Office floor assignment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          {seatValid ? (
            <>
              <span>
                Assigned to seat{" "}
                <span className="font-mono font-semibold">{employee.bayNumber}</span>
              </span>
              <ButtonLink href="/seating" label="View floor plan" />
            </>
          ) : employee.bayNumber ? (
            <span className="text-muted-foreground">
              Legacy seat <span className="font-mono">{employee.bayNumber}</span> — use{" "}
              <strong>Edit employee</strong> to assign a valid seat (e.g. D3).
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">No seat assigned.</span>
              <ButtonLink href="/seating" label="Open seating" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ButtonLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
    >
      {label}
    </Link>
  );
}

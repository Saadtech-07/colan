"use client";

import Link from "next/link";
import {
  Briefcase,
  Building2,
  Calendar,
  Mail,
  MapPin,
  Pencil,
  UserPlus,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { projectStatusVariant } from "@/lib/project-assignments";
import { formatWorkspaceDate, parseSeatAllocation } from "@/lib/employee-workspace-ui";
import { buildWorkforceAccess } from "@/lib/team-members-ui";
import { appUserEditHref } from "@/lib/app-user-navigation";
import type { AccessContext } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { EmployeeDetail, Project } from "@/types";

type Props = {
  employee: EmployeeDetail;
  projects: Project[];
  access: AccessContext | null;
};

export function EmployeeWorkspaceView({ employee, projects, access }: Props) {
  const directory = employee.directory;
  const workforceAccess = buildWorkforceAccess(access);
  const seat = parseSeatAllocation(employee.bayNumber);
  const joinedDate = formatWorkspaceDate(directory?.joinedDate);
  const loginEmail = employee.email?.trim() || "";
  const workEmail = directory?.workEmail?.trim() || "";
  const phone = directory?.phone?.trim() || "";
  const location = directory?.location?.trim() || "";

  const assignedProjects =
    employee.assignedProjects.length > 0
      ? employee.assignedProjects
      : projects.filter((project) => project.memberIds?.includes(employee.id));

  const initials = employee.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-full space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_20px_60px_-32px_rgba(15,23,42,0.45)]">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.08)_0%,rgba(14,165,233,0.06)_45%,transparent_70%)]" />
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative px-6 py-7 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <div className="rounded-full bg-gradient-to-br from-primary/20 via-indigo-400/15 to-sky-400/20 p-1 shadow-[0_12px_40px_-16px_rgba(59,130,246,0.55)]">
                  <Avatar className="h-[120px] w-[120px] border-[3px] border-background bg-background">
                    <AvatarImage
                      src={employee.imageUrl}
                      alt={employee.name}
                      className="object-cover object-center"
                    />
                    <AvatarFallback className="bg-muted text-3xl font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>

              <div className="min-w-0 space-y-3 pt-1">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2rem]">
                    {employee.name}
                  </h1>
                  <p className="mt-1 font-mono text-sm text-muted-foreground">
                    Employee ID · {employee.employeeId}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <MetaChip icon={Users} label="Team" value={employee.team} />
                  <MetaChip icon={Calendar} label="Joined" value={joinedDate} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:max-w-md xl:justify-end">
              {workforceAccess.canManageEmployees ? (
                <Button variant="outline" size="sm" className="h-9 rounded-lg bg-background/80" asChild>
                  <Link href={appUserEditHref(employee.employeeId)}>
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit employee
                  </Link>
                </Button>
              ) : null}
              {workforceAccess.canAssignProjects ? (
                <Button size="sm" className="h-9 rounded-lg shadow-sm" asChild>
                  <Link href="/projects">
                    <UserPlus className="mr-1.5 h-4 w-4" />
                    Assign project
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <RecordPanel
        title="Project assignments"
        icon={Briefcase}
        description="Active project memberships for this employee"
      >
        {assignedProjects.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200/70 dark:bg-zinc-800/80">
              <Briefcase className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-200">
              No projects assigned
            </p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Assign this employee from Team Projects.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200/70 dark:divide-zinc-800/80">
            {assignedProjects.map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.slug}`}
                  className="group flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 transition-colors group-hover:text-primary dark:text-zinc-100">
                      {project.name}
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      Assigned {formatWorkspaceDate(project.assignedDate)}
                    </p>
                  </div>
                  <Badge variant={projectStatusVariant(project.status)} className="shrink-0">
                    {project.status}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </RecordPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <RecordPanel
          title="Employee details"
          icon={Users}
          description="Core profile information from App Users"
        >
          <InfoGrid>
            <InfoRow label="Full name" value={employee.name} />
            <InfoRow label="Employee ID" value={employee.employeeId} mono />
            <InfoRow label="Role" value={employee.role} />
            <InfoRow label="Team" value={employee.team} />
            <InfoRow label="Joined date" value={joinedDate} last />
          </InfoGrid>
        </RecordPanel>

        <RecordPanel
          title="Contact & location"
          icon={Mail}
          description="Reachability and office address"
        >
          <InfoGrid>
            <InfoRow
              label="Work email"
              value={workEmail}
              href={workEmail ? `mailto:${workEmail}` : undefined}
            />
            <InfoRow
              label="Login email"
              value={loginEmail}
              href={loginEmail ? `mailto:${loginEmail}` : undefined}
            />
            <InfoRow label="Phone number" value={phone} />
            <InfoRow label="Office location" value={location} last icon={MapPin} />
          </InfoGrid>
        </RecordPanel>
      </div>

      <RecordPanel
        title="Workspace allocation"
        icon={Building2}
        description="Assigned desk and floor plan location"
      >
        <InfoGrid columns={2}>
          <InfoRow label="Building" value={seat.isAssigned ? seat.building : ""} />
          <InfoRow label="Floor" value={seat.isAssigned ? seat.floor : ""} />
          <InfoRow label="Bay" value={seat.isAssigned ? seat.bay : ""} />
          <InfoRow
            label="Seat number"
            value={seat.isAssigned ? seat.seatNumber : ""}
            last
          />
        </InfoGrid>
      </RecordPanel>
    </div>
  );
}

function MetaChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function RecordPanel({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/80 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <header className="flex items-start gap-3 border-b border-zinc-200/70 bg-zinc-100/70 px-5 py-4 dark:border-zinc-800/80 dark:bg-zinc-800/50">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200/80 dark:bg-zinc-700/60">
          <Icon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-800 dark:text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

function InfoGrid({
  children,
  columns = 1,
}: {
  children: React.ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <dl
      className={cn(
        "p-2",
        columns === 2 && "grid gap-0 sm:grid-cols-2 sm:p-3",
      )}
    >
      {children}
    </dl>
  );
}

function InfoRow({
  label,
  value,
  href,
  mono,
  last,
  icon: Icon,
}: {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  last?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const display = value.trim() || "Not provided";
  const isEmpty = display === "Not provided";

  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3.5 transition-colors",
        "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30",
        !last && "mb-0.5",
      )}
    >
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,140px)_1fr] sm:items-baseline sm:gap-4">
        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          {label}
        </dt>
        <dd
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium text-zinc-800 dark:text-zinc-100",
            mono && !isEmpty && "font-mono text-[13px]",
            isEmpty && "font-normal text-zinc-400 dark:text-zinc-500",
          )}
        >
          {Icon && !isEmpty ? (
            <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
          ) : null}
          {href && !isEmpty ? (
            <a href={href} className="text-zinc-700 underline-offset-2 hover:text-primary hover:underline dark:text-zinc-200">
              {display}
            </a>
          ) : (
            display
          )}
        </dd>
      </div>
    </div>
  );
}

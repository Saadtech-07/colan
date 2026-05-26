"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  EditEmployeeButton,
  EditEmployeeDialog,
} from "@/components/features/edit-employee-dialog";
import { EmployeeDetailView } from "@/components/features/employee-detail-view";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { parseApiError, useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import {
  canAssignEmployeeProjects,
  canManageProject,
} from "@/lib/permissions";
import {
  buildWorkforceAccess,
  employeeAssignedProjects,
  employeeAvailabilityState,
  employeeWorkloadPercent,
  employeeWorkspaceStatus,
} from "@/lib/team-members-ui";
import type { EmployeeDetail, EmployeeDirectoryInfo } from "@/types";
import { ManageEmployeeProjectsDialog } from "@/components/features/manage-employee-projects-dialog";

export default function TeamMemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug ?? "");
  const { access, projects, refreshData } = useAppState();
  const { withLoading } = useGlobalLoading();
  const [employee, setEmployee] = React.useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);

  const workforceAccess = React.useMemo(
    () => buildWorkforceAccess(access),
    [access],
  );

  const canManageProjectForUser = React.useCallback(
    (project: (typeof projects)[number]) =>
      !!access && canManageProject(access.role, project.teams, access.team),
    [access],
  );

  const loadEmployee = React.useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      await withLoading("employee-detail", LOADING_PRESETS.loadingAccounts, async () => {
        const res = await fetch(`/api/employees/${slug}`, { credentials: "include" });
        if (!res.ok) throw new Error(await parseApiError(res));
        setEmployee((await res.json()) as EmployeeDetail);
      });
    } catch (e) {
      setEmployee(null);
      setError(e instanceof Error ? e.message : "Failed to load employee");
    } finally {
      setLoading(false);
    }
  }, [slug, withLoading]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEmployee();
  }, [loadEmployee]);

  const handleRefresh = async () => {
    await refreshData();
    await loadEmployee();
  };

  const handleSave = async (
    id: string,
    patch: Partial<EmployeeDetail> & { directory?: Partial<EmployeeDirectoryInfo> },
  ) => {
    if (!employee) return;
    await withLoading("employee-save", LOADING_PRESETS.updatingEmployee, async () => {
      const res = await fetch(`/api/employees/${employee.slug}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await handleRefresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2 rounded-xl" asChild>
            <Link href="/team-members">
              <ArrowLeft className="h-4 w-4" />
              All team members
            </Link>
          </Button>
          {employee && !loading && (
            <p className="text-sm text-muted-foreground">
              /team-members/{employee.slug}
            </p>
          )}
        </div>
        {employee && !loading && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {workforceAccess.canManageEmployees && (
                <EditEmployeeButton
                  className="shrink-0"
                  onClick={() => setEditOpen(true)}
                />
              )}
              {!!access && canAssignEmployeeProjects(access.role) && (
                <ManageEmployeeProjectsDialog
                  employee={employee}
                  projects={projects}
                  canManage
                  canManageProject={canManageProjectForUser}
                  onUpdated={handleRefresh}
                  triggerClassName="h-11 gap-1.5 rounded-2xl border-border/70 bg-background/80 px-5 shadow-sm"
                />
              )}
              <Button
                variant="outline"
                className="h-11 rounded-2xl border-border/70 bg-background/80 px-5 shadow-sm"
                asChild
              >
                <a href="#employee-performance">
                  <BarChart3 className="h-4 w-4" />
                  View Analytics
                </a>
              </Button>
            </div>
            <EditEmployeeDialog
              employee={employee}
              projectCount={employee.assignedProjects.length}
              open={editOpen}
              onOpenChange={setEditOpen}
              hideTrigger
              onSave={handleSave}
              onDelete={async () => {
                await withLoading("employee-delete", LOADING_PRESETS.removingEmployee, async () => {
                  const res = await fetch(`/api/employees/${employee.slug}`, {
                    method: "DELETE",
                    credentials: "include",
                  });
                  if (!res.ok) throw new Error(await parseApiError(res));
                  await refreshData();
                  router.push("/team-members");
                });
              }}
            />
          </>
        )}
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading employee profile…</p>
      )}

      {error && !loading && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {employee && !loading && (
        <>
          <EmployeeWorkspaceHero
            employee={employee}
            projects={projects}
          />

          <EmployeeDetailView
            employee={employee}
            projects={projects}
            canAssignProjects={!!access && canAssignEmployeeProjects(access.role)}
            canManageProject={canManageProjectForUser}
            onRefresh={handleRefresh}
          />
        </>
      )}
    </div>
  );
}

function EmployeeWorkspaceHero({
  employee,
  projects,
}: {
  employee: EmployeeDetail;
  projects: ReturnType<typeof useAppState>["projects"];
}) {
  const availability = employeeAvailabilityState(employee, projects);
  const workspace = employeeWorkspaceStatus(employee);
  const workload = employeeWorkloadPercent(employee, projects);
  const assignedProjects = employeeAssignedProjects(employee, projects);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/75 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_30%)]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-5">
            <Avatar className="h-20 w-20 ring-2 ring-border/70 sm:h-24 sm:w-24">
              <AvatarImage src={employee.imageUrl} alt={employee.name} />
              <AvatarFallback className="text-xl sm:text-2xl">
                {employee.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Employee workspace
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {employee.name}
                </h1>
                <p className="font-mono text-sm text-muted-foreground">{employee.employeeId}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="font-normal">
                  {employee.team}
                </Badge>
                <Badge variant="outline">{employee.role}</Badge>
                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${workspace.toneClass}`}
                >
                  <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                  {workspace.label}
                </div>
                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${availability.toneClass}`}
                >
                  {availability.label}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <HeroMetric
            icon={<BriefcaseBusiness className="h-4 w-4 text-primary" />}
            label="Current assignments"
            value={`${assignedProjects.length}`}
            hint={
              assignedProjects.length === 1
                ? "Project assigned"
                : "Projects assigned"
            }
          />
          <HeroMetric
            icon={<BarChart3 className="h-4 w-4 text-emerald-500" />}
            label="Workload"
            value={`${workload}%`}
            hint="Portfolio-based delivery load"
          />
          <HeroMetric
            icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
            label="Workspace status"
            value={workspace.label}
            hint={employee.directory?.joinedDate ? `Joined ${employee.directory.joinedDate}` : "Join date unavailable"}
          />
        </div>
      </div>
    </section>
  );
}

function HeroMetric({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card className="border-border/60 bg-background/70 shadow-sm backdrop-blur-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {label}
            </p>
            <p className="text-sm font-semibold text-foreground sm:text-base">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-2.5">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

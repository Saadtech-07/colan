"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  filterProjectsForUser,
} from "@/lib/permissions";
import type { EmployeeDetail, EmployeeDirectoryInfo } from "@/types";

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

  const canWriteEmployees = !!access?.canWriteEmployees;

  const canManageProjectForUser = React.useCallback(
    (project: (typeof projects)[number]) =>
      !!access && canManageProject(access.role, project.teams, access.team),
    [access, projects],
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
          <Button variant="ghost" size="sm" className="gap-1 -ml-2" asChild>
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
        {canWriteEmployees && employee && !loading && (
          <>
            <EditEmployeeButton
              className="shrink-0"
              onClick={() => setEditOpen(true)}
            />
            <EditEmployeeDialog
              employee={employee}
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
        <EmployeeDetailView
          employee={employee}
          projects={projects}
          canAssignProjects={!!access && canAssignEmployeeProjects(access.role)}
          canManageProject={canManageProjectForUser}
          onRefresh={handleRefresh}
        />
      )}
    </div>
  );
}

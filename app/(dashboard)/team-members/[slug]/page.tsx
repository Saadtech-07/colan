"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeeWorkspaceView } from "@/components/features/employee-workspace-view";
import { parseApiError, useAppState } from "@/providers/app-state";
import type { EmployeeDetail } from "@/types";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";

export default function TeamMemberDetailPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const { dataLoading, projects, access } = useAppState();
  const [employee, setEmployee] = React.useState<EmployeeDetail | null>(null);
  const [pageLoading, setPageLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const dataLoadingRef = React.useRef(dataLoading);

  React.useEffect(() => {
    dataLoadingRef.current = dataLoading;
  }, [dataLoading]);

  const waitForWorkspaceSyncToFinish = React.useCallback(async () => {
    await new Promise<void>((resolve) => {
      const check = () => {
        if (!dataLoadingRef.current) {
          resolve();
          return;
        }
        window.setTimeout(check, 40);
      };

      check();
    });
  }, []);

  const loadEmployee = React.useCallback(async (options?: { preserveVisibleContent?: boolean }) => {
    if (!slug) {
      setPageLoading(false);
      return;
    }
    if (!options?.preserveVisibleContent) {
      setPageLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/employees/${slug}`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseApiError(res));
      setEmployee((await res.json()) as EmployeeDetail);
      if (!options?.preserveVisibleContent) {
        await waitForWorkspaceSyncToFinish();
      }
    } catch (e) {
      setEmployee(null);
      setError(e instanceof Error ? e.message : "Failed to load employee");
    } finally {
      if (!options?.preserveVisibleContent) {
        setPageLoading(false);
      }
    }
  }, [slug, waitForWorkspaceSyncToFinish]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEmployee();
  }, [loadEmployee]);

  return (
    <PageLoadingShell
      loading={pageLoading}
      title="Loading employee workspace"
      minLoadingHeight="480px"
      className="w-full space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="gap-1 -ml-2 h-8 rounded-lg px-2" asChild>
            <Link href="/team-members">
              <ArrowLeft className="h-4 w-4" />
              Team directory
            </Link>
          </Button>
          {employee && !pageLoading && (
            <p className="text-xs text-muted-foreground">
              Employee workspace · /team-members/{employee.slug}
            </p>
          )}
        </div>
      </div>

      {error && !pageLoading && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {employee && !pageLoading && (
        <EmployeeWorkspaceView
          employee={employee}
          projects={projects}
          access={access}
        />
      )}
    </PageLoadingShell>
  );
}

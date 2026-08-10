"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CircleCheckBig,
  ShieldAlert,
  Users2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjectDetailEditor } from "@/components/features/project-detail-editor";
import { EntityTasksPanel } from "@/components/features/tasks/entity-tasks-panel";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import { PageTitle } from "@/components/ui/page-typography";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import {
  formatProjectDate,
  projectPriority,
  projectProgressPercent,
  relativeProjectDeadline,
} from "@/lib/project-ui";
import { fetchProjectBySlugOnce } from "@/lib/workspace-api-client";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { canManageProject } from "@/lib/permissions";
import type { ProjectDetail } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params.slug ?? "");
  const { access, user, employees, applyProjectUpdate } = useAppState();
  const { withLoading } = useGlobalLoading();
  const withLoadingRef = React.useRef(withLoading);
  React.useEffect(() => {
    withLoadingRef.current = withLoading;
  }, [withLoading]);
  const [project, setProject] = React.useState<ProjectDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saveSuccessOpen, setSaveSuccessOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        await withLoadingRef.current(
          "project-detail",
          LOADING_PRESETS.loadingProject,
          async () => {
            const detail = await fetchProjectBySlugOnce<ProjectDetail>(slug);
            if (!cancelled) setProject(detail);
          },
        );
      } catch (e) {
        if (cancelled) return;
        setProject(null);
        setError(e instanceof Error ? e.message : "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const canEdit =
    !!access &&
    !!project &&
    canManageProject(access.role, project.teams, access.team);
  const today = React.useMemo(() => new Date(), []);

  const reloadProject = React.useCallback(async () => {
    if (!slug) return;
    try {
      const detail = await fetchProjectBySlugOnce<ProjectDetail>(slug, {
        force: true,
      });
      setProject(detail);
    } catch {
      // Keep current project snapshot if refresh fails.
    }
  }, [slug]);

  const onSaved = React.useCallback(
    (detail: ProjectDetail) => {
      setProject(detail);
      applyProjectUpdate(detail);
      setSaveSuccessOpen(true);
    },
    [applyProjectUpdate],
  );

  const returnToProjects = React.useCallback(() => {
    setSaveSuccessOpen(false);
    router.push("/projects");
  }, [router]);

  const handleTasksChange = React.useCallback(() => {
    void reloadProject();
  }, [reloadProject]);

  const projectTasksPanel = React.useMemo(
    () =>
      project ? (
        <EntityTasksPanel
          variant="embedded"
          projectId={project.id}
          title="Project tasks"
          description="Tasks created for this project workspace"
          emptyMessage="No tasks for this project yet."
          onTasksChange={handleTasksChange}
        />
      ) : null,
    [handleTasksChange, project],
  );

  return (
    <div className="space-y-6">
      <Dialog
        open={saveSuccessOpen}
        onOpenChange={(open) => {
          if (!open) returnToProjects();
        }}
      >
        <DialogContent className="max-w-sm rounded-[24px] border-border/70 bg-background/95 text-center shadow-2xl backdrop-blur-xl sm:max-w-md [&>button]:hidden">
          <DialogHeader className="items-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CircleCheckBig className="h-7 w-7" />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Saved successfully
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Your project changes have been saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 sm:justify-center">
            <Button
              type="button"
              className="h-11 min-w-[120px] rounded-2xl px-6"
              onClick={returnToProjects}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1 rounded-xl" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            All projects
          </Link>
        </Button>
      </div>

      {error && !loading && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && (
        <div className="space-y-6 animate-pulse">
          <div className="h-52 rounded-[28px] border border-border/60 bg-muted/30" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
            <div className="h-[420px] rounded-[24px] border border-border/60 bg-muted/30" />
            <div className="h-[420px] rounded-[24px] border border-border/60 bg-muted/30" />
          </div>
        </div>
      )}

      {project && !loading && (
        <>
          <ProjectWorkspaceHero project={project} canEdit={canEdit} today={today} />

          <ProjectDetailEditor
            key={project.slug}
            project={project}
            teamRoster={employees}
            canEdit={canEdit}
            lockedTeam={access?.role === "lead" ? user?.team : undefined}
            embedTasksInOverview={access?.role === "employee"}
            onSaved={onSaved}
            tasksPanel={projectTasksPanel}
          />
        </>
      )}
    </div>
  );
}
function ProjectWorkspaceHero({
  project,
  canEdit,
  today,
}: {
  project: ProjectDetail;
  canEdit: boolean;
  today: Date;
}) {
  const progress = projectProgressPercent(project, today);
  const priority = projectPriority(project, today);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-border/70 bg-background/75 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(6,182,212,0.08),transparent_30%)]" />
      <div className="relative space-y-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-4">
            <div className="space-y-3">
              <PageTitle as="h1" className="text-2xl sm:text-3xl">
                {project.name}
              </PageTitle>
              <div className="flex flex-wrap items-center gap-2">
                {project.teams.map((team) => (
                  <Badge
                    key={team}
                    variant="outline"
                    className="rounded-full bg-background/70 px-3 py-1 font-medium"
                  >
                    {team.replace(" Team", "")}
                  </Badge>
                ))}
                {canEdit ? (
                  <>
                    <ProjectStatusSelect value={project.status} canEdit={false} />
                    <div
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${priority.toneClass}`}
                    >
                      {priority.label}
                    </div>
                    <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {progress}% progress
                    </div>
                  </>
                ) : null}
              </div>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              /projects/{project.slug}
              {canEdit
                ? " · You can manage this project workspace."
                : " · Read-only workspace for your current role."}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <HeroMetricCard
            icon={<CalendarClock className="h-4 w-4 text-amber-500" />}
            label="Deadline"
            value={formatProjectDate(project.lastDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            hint={relativeProjectDeadline(project.lastDate, today)}
          />
          <HeroMetricCard
            icon={<Users2 className="h-4 w-4 text-primary" />}
            label="Assigned members"
            value={`${project.members.length}`}
            hint={project.members.length === 1 ? "Contributor assigned" : "Contributors assigned"}
          />
          <HeroMetricCard
            icon={<ShieldAlert className="h-4 w-4 text-emerald-500" />}
            label="Timeline"
            value={`${formatProjectDate(project.assignedDate, {
              month: "short",
              day: "numeric",
            })} - ${formatProjectDate(project.lastDate, {
              month: "short",
              day: "numeric",
            })}`}
            hint={project.status === "Completed" ? "Delivery completed" : "Current schedule"}
          />
        </div>
      </div>
    </section>
  );
}

function HeroMetricCard({
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


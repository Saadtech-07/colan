"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  FolderKanban,
  PencilLine,
  ShieldAlert,
  Sparkles,
  Users2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProjectDetailEditor } from "@/components/features/project-detail-editor";
import { ProjectStatusSelect } from "@/components/features/project-status-select";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import {
  formatProjectDate,
  projectPriority,
  projectProgressPercent,
  relativeProjectDeadline,
} from "@/lib/project-ui";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { canManageProject } from "@/lib/permissions";
import type { ProjectDetail } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const { access, user, employees, refreshData } = useAppState();
  const { withLoading } = useGlobalLoading();
  const [project, setProject] = React.useState<ProjectDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        await withLoading("project-detail", LOADING_PRESETS.loadingProject, async () => {
          const res = await fetch(`/api/projects/${slug}`, { credentials: "include" });
          if (cancelled) return;
          if (!res.ok) {
            const j = (await res.json()) as { error?: string };
            throw new Error(j.error ?? res.statusText);
          }
          setProject((await res.json()) as ProjectDetail);
        });
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
  }, [slug, withLoading]);

  const canEdit =
    !!access &&
    !!project &&
    canManageProject(access.role, project.teams, access.team);
  const today = React.useMemo(() => new Date(), []);

  const onSaved = (detail: ProjectDetail) => {
    setProject(detail);
    void refreshData();
  };

  return (
    <div className="space-y-6">
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
            onSaved={onSaved}
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
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <FolderKanban className="h-3.5 w-3.5" />
              Project workspace
            </div>
            <div className="space-y-3">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {project.name}
              </h1>
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
                <ProjectStatusSelect value={project.status} canEdit={false} />
                <div
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${priority.toneClass}`}
                >
                  {priority.label}
                </div>
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {progress}% progress
                </div>
              </div>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              /projects/{project.slug}
              {canEdit
                ? " · You can manage this project workspace."
                : " · Read-only workspace for your current role."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {canEdit ? (
              <>
                <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-background/80 shadow-sm" asChild>
                  <a href="#project-details">
                    <PencilLine className="h-4 w-4" />
                    Edit details
                  </a>
                </Button>
                <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-background/80 shadow-sm" asChild>
                  <a href="#project-schedule">
                    <Sparkles className="h-4 w-4" />
                    Update status
                  </a>
                </Button>
                <Button className="h-11 rounded-2xl shadow-sm" asChild>
                  <a href="#project-members">
                    <Users2 className="h-4 w-4" />
                    Assign members
                  </a>
                </Button>
              </>
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                View-only workspace
              </div>
            )}
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

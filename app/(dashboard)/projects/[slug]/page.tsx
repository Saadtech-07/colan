"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProjectDetailEditor } from "@/components/features/project-detail-editor";
import { useAppState } from "@/providers/app-state";
import { canManageProjectForTeam } from "@/lib/permissions";
import type { ProjectDetail } from "@/types";

export default function ProjectDetailPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const { access, user, employees, refreshData } = useAppState();
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
        const res = await fetch(`/api/projects/${slug}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        setProject((await res.json()) as ProjectDetail);
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
    canManageProjectForTeam(access.role, project.team, access.team);

  const onSaved = (detail: ProjectDetail) => {
    setProject(detail);
    void refreshData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" asChild>
          <Link href="/projects">
            <ArrowLeft className="h-4 w-4" />
            All projects
          </Link>
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Loading project…</p>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {project && !loading && (
        <>
          <header className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                {project.name}
              </h1>
              <Badge variant="secondary">{project.team}</Badge>
              <Badge>{project.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              /projects/{project.slug}
              {canEdit
                ? " · You can edit this project"
                : " · View only for your role"}
            </p>
          </header>

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
